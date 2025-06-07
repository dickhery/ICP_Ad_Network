import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Nat64 "mo:base/Nat64";

// CHANGED: Import the remote canister interface so we can use its types directly
import TransferBackend "canister:icp_transfer_backend";

actor AdNetwork {
  public type Tokens = TransferBackend.Tokens;
  public type TransferArgs = TransferBackend.TransferArgs;
  public type TransferResult = TransferBackend.Result;
  public type Blob = [Nat8];

  let COST_PER_VIEW : Nat = 100_000; // 0.001 ICP per view
  let REWARD_PER_VIEW : Nat = 71_000; // 0.00071 ICP per view

  public type Ad = {
    id : Nat;
    name : Text;
    advertiser : Principal;
    imageBase64 : Text;
    clickUrl : Text;
    viewsPurchased : Nat;
    viewsServed : Nat;
    adType : Text;
  };

  public type AdLite = {
    id : Nat;
    name : Text;
    advertiser : Principal;
    clickUrl : Text;
    viewsPurchased : Nat;
    viewsServed : Nat;
    adType : Text;
  };

  public type Project = {
    id : Text;
    owner : Principal;
    views : Nat;
    contact : Text;
  };

  public type LogEntry = {
    timestamp : Nat;
    caller : Principal;
    method : Text;
    details : Text;
  };

  // Ephemeral token record
  public type EphemeralRecord = {
    tokenId : Nat;
    adId : Nat;
    projectId : Text;
    createdAt : Nat64; // time in nanoseconds
    used : Bool;
  };

  stable var logs : [LogEntry] = [];
  stable var ads : [Ad] = [];
  stable var nextAdId : Nat = 0;
  stable var projects : [Project] = [];
  stable var lastServedAdId : ?Nat = null;
  stable var storedPassword : Text = "Nextlevel";
  stable var ephemeralRecords : [EphemeralRecord] = [];
  stable var nextTokenId : Nat = 0; // increment for each ephemeral record

  func logAction(method : Text, details : Text, caller : Principal) {
    let timestampNat = Nat64.toNat(Nat64.fromIntWrap(Time.now()));
    logs := Array.append<LogEntry>(
      logs,
      [{
        timestamp = timestampNat;
        caller = caller;
        method = method;
        details = details;
      }],
    );
    Debug.print("LOG: " # method # " :: " # details);
  };

  func replaceAd(a : [Ad], i : Nat, newVal : Ad) : [Ad] {
    if (i >= a.size()) { return a };
    return Array.tabulate<Ad>(
      a.size(),
      func(j : Nat) : Ad {
        if (j == i) { newVal } else { a[j] };
      },
    );
  };

  func replaceProject(a : [Project], i : Nat, newVal : Project) : [Project] {
    if (i >= a.size()) { return a };
    return Array.tabulate<Project>(
      a.size(),
      func(j : Nat) : Project {
        if (j == i) { newVal } else { a[j] };
      },
    );
  };

  func findAdPosition(a : [Ad], predicate : (Ad) -> Bool) : ?Nat {
    for (i in Iter.range(0, a.size() - 1)) {
      if (predicate(a[i])) {
        return ?i;
      };
    };
    return null;
  };

  func findProjectPosition(a : [Project], predicate : (Project) -> Bool) : ?Nat {
    for (i in Iter.range(0, a.size() - 1)) {
      if (predicate(a[i])) {
        return ?i;
      };
    };
    return null;
  };

  func sortAdsAsc(a : [Ad]) : [Ad] {
    if (a.size() <= 1) { return a };
    let arr = Array.thaw<Ad>(a);
    for (i in Iter.range(0, arr.size() - 2)) {
      for (j in Iter.range(i + 1, arr.size() - 1)) {
        if (arr[j].id < arr[i].id) {
          let temp = arr[i];
          arr[i] := arr[j];
          arr[j] := temp;
        };
      };
    };
    Array.freeze(arr);
  };

  public shared (msg) func getMyAdsLite() : async [AdLite] {
    let callerPrincipal = msg.caller;
    let userAds = Array.filter<Ad>(ads, func(ad) { ad.advertiser == callerPrincipal });
    let userAdsLite = Array.map<Ad, AdLite>(
      userAds,
      func(ad) {
        {
          id = ad.id;
          name = ad.name;
          advertiser = ad.advertiser;
          clickUrl = ad.clickUrl;
          viewsPurchased = ad.viewsPurchased;
          viewsServed = ad.viewsServed;
          adType = ad.adType;
        };
      },
    );
    userAdsLite;
  };

  public shared (msg) func createAd(
    name : Text,
    imageBase64 : Text,
    clickUrl : Text,
    viewsToPurchase : Nat,
    adType : Text,
  ) : async Nat {
    let caller = msg.caller;
    let newAd : Ad = {
      id = nextAdId;
      name = name;
      advertiser = caller;
      imageBase64 = imageBase64;
      clickUrl = clickUrl;
      viewsPurchased = viewsToPurchase;
      viewsServed = 0;
      adType = adType;
    };
    ads := Array.append(ads, [newAd]);
    nextAdId += 1;
    logAction("createAd", "Created Ad '" # name # "' with ID #" # Nat.toText(newAd.id) # ", views=" # Nat.toText(viewsToPurchase), caller);
    return newAd.id;
  };

  public shared (msg) func registerProject(projectId : Text, contact : Text) : async Bool {
    let existingIdx = findProjectPosition(projects, func(p) { p.id == projectId });
    switch (existingIdx) {
      case (?_) { false };
      case null {
        let newProj : Project = {
          id = projectId;
          owner = msg.caller;
          views = 0;
          contact = contact;
        };
        projects := Array.append(projects, [newProj]);
        true;
      };
    };
  };

  /**
   * Returns (ad, tokenId).
   * The front end should store tokenId in order to call recordViewWithToken later.
   */
  public query func getNextAd(projectId : Text, adType : Text) : async ?(Ad, Text) {
    switch (DMap.get(projects, projectId)) {
        case null return null;
        case (?project) {
            let availableAds = Buffer.fromArray<Ad>(
                Iter.toArray(
                    Iter.filter(
                        DMap.entries(ads),
                        func((id, ad) : (Text, Ad)) {
                            ad.viewsPurchased > ad.viewsServed and (adType == "" or ad.adType == adType)
                        }
                    )
                )
            );

            if (availableAds.size() == 0) return null;

            // Round-robin selection
            let lastIndex = switch (DMap.get(lastAdIndex, projectId)) {
                case null 0;
                case (?idx) idx;
            };

            let nextIndex = (lastIndex + 1) % availableAds.size();
            DMap.put(lastAdIndex, projectId, nextIndex);

            let ad = availableAds.get(nextIndex);
            let tokenId = generateTokenId(projectId, ad.id);
            return ?(ad, tokenId);
        };
    };
};

  public shared (msg) func recordViewWithToken(tokenId : Nat) : async Bool {
    var idxOpt : ?Nat = null;
    var i = 0;
    let size = ephemeralRecords.size();

    label l while (i < size and idxOpt == null) {
      if (ephemeralRecords[i].tokenId == tokenId) {
        idxOpt := ?i;
      };
      i += 1;
    };

    switch (idxOpt) {
      case null {
        Debug.print("recordViewWithToken: invalid token " # Nat.toText(tokenId));
        return false;
      };
      case (?i) {
        let rec = ephemeralRecords[i];
        if (rec.used) {
          Debug.print("recordViewWithToken: token already used " # Nat.toText(tokenId));
          return false;
        };
        let nowNs = Nat64.fromIntWrap(Time.now());
        let delta = Nat64.subWrap(nowNs, rec.createdAt);
        let fiveSecNs : Nat64 = 5_000_000_000; // 5 sec in nanoseconds
        if (delta < fiveSecNs) {
          Debug.print("recordViewWithToken: called too soon " # Nat.toText(tokenId));
          return false;
        };

        // Mark the token as used
        ephemeralRecords := Array.tabulate<EphemeralRecord>(
          ephemeralRecords.size(),
          func(j : Nat) : EphemeralRecord {
            if (j == i) {
              {
                tokenId = rec.tokenId;
                adId = rec.adId;
                projectId = rec.projectId;
                createdAt = rec.createdAt;
                used = true;
              };
            } else {
              ephemeralRecords[j];
            };
          },
        );

        // Now serve/increment the ad
        let success = serveAdById(rec.adId, rec.projectId);
        switch (success) {
          case null { return false };
          case (?_) { return true };
        };
      };
    };
  };

  func serveAdById(adId : Nat, projectId : Text) : ?Ad {
    let idxOpt = findAdPosition(ads, func(a) { a.id == adId });
    switch (idxOpt) {
      case null { null };
      case (?i) { serveAdAtIndex(i, projectId) };
    };
  };

  func serveAdAtIndex(i : Nat, projectId : Text) : ?Ad {
    if (i >= ads.size()) { return null };
    let ad = ads[i];
    if (ad.viewsServed >= ad.viewsPurchased) { return null };
    let updatedAd = {
      id = ad.id;
      name = ad.name;
      advertiser = ad.advertiser;
      imageBase64 = ad.imageBase64;
      clickUrl = ad.clickUrl;
      viewsPurchased = ad.viewsPurchased;
      viewsServed = ad.viewsServed + 1;
      adType = ad.adType;
    };
    ads := replaceAd(ads, i, updatedAd);

    let projIdxOpt = findProjectPosition(projects, func(p) { p.id == projectId });
    switch (projIdxOpt) {
      case (?pjIdx) {
        let proj = projects[pjIdx];
        let updatedProject = {
          id = proj.id;
          owner = proj.owner;
          views = proj.views + 1;
          contact = proj.contact;
        };
        projects := replaceProject(projects, pjIdx, updatedProject);
      };
      case null {
        Debug.print("serveAdAtIndex: Project not registered: " # projectId);
      };
    };
    lastServedAdId := ?updatedAd.id;
    ?updatedAd;
  };

  public shared (msg) func purchaseViews(adId : Nat, additionalViews : Nat) : async Bool {
    let caller = msg.caller;
    let idxOpt = findAdPosition(ads, func(x) { x.id == adId });
    switch (idxOpt) {
      case null { false };
      case (?i) {
        let oldAd = ads[i];
        if (oldAd.advertiser != caller) {
          Debug.print("Unauthorized top-up by " # Principal.toText(caller));
          false;
        } else {
          let updatedAd = {
            id = oldAd.id;
            name = oldAd.name;
            advertiser = oldAd.advertiser;
            imageBase64 = oldAd.imageBase64;
            clickUrl = oldAd.clickUrl;
            viewsPurchased = oldAd.viewsPurchased + additionalViews;
            viewsServed = oldAd.viewsServed;
            adType = oldAd.adType;
          };
          ads := replaceAd(ads, i, updatedAd);

          logAction(
            "purchaseViews",
            "Ad ID=" # Nat.toText(adId)
            # ", +Views=" # Nat.toText(additionalViews),
            caller,
          );
          true;
        };
      };
    };
  };

  public shared (msg) func cashOutProject(projectId : Text) : async Nat {
    let caller = msg.caller;
    let projectIdxOpt = findProjectPosition(
      projects,
      func(p) { p.id == projectId and p.owner == caller },
    );
    switch (projectIdxOpt) {
      case null {
        Debug.print("cashOutProject: not found or not owned: " # projectId);
        0;
      };
      case (?idx) {
        let proj = projects[idx];
        let currentViews = proj.views;
        if (currentViews == 0) {
          Debug.print("cashOutProject: no views to cash out for " # projectId);
          return 0;
        };
        let e8sToTransfer = currentViews * REWARD_PER_VIEW;
        let e8s64 = Nat64.fromNat(e8sToTransfer);

        let updatedProj = {
          id = proj.id;
          owner = proj.owner;
          views = 0;
          contact = proj.contact;
        };
        projects := replaceProject(projects, idx, updatedProj);

        Debug.print(
          "cashOutProject: transferring " # Nat.toText(e8sToTransfer)
          # " e8s to " # Principal.toText(caller)
        );

        let transferArgs : TransferArgs = {
          to_principal = caller;
          to_subaccount = null;
          amount = { e8s = e8s64 };
        };

        let result : TransferResult = await TransferBackend.transfer(transferArgs);
        switch (result) {
          case (#Ok(blockIndex)) {
            let msgText = "cashOutProject success: projectId=" # projectId
            # ", views=" # Nat.toText(currentViews)
            # ", e8sPaid=" # Nat.toText(e8sToTransfer)
            # ", blockIndex=" # Nat64.toText(blockIndex);
            logAction("cashOutProject", msgText, caller);
            currentViews;
          };
          case (#Err(errMsg)) {
            let revertProj = {
              id = proj.id;
              owner = proj.owner;
              views = currentViews;
              contact = proj.contact;
            };
            projects := replaceProject(projects, idx, revertProj);

            let errorMsg = "cashOutProject error: " # errMsg;
            Debug.print(errorMsg);
            logAction("cashOutProject", errorMsg, caller);
            0;
          };
        };
      };
    };
  };

  public shared (msg) func cashOutAllProjects() : async Nat {
    let caller = msg.caller;
    var totalViews : Nat = 0;
    let myProjects = Array.filter<Project>(projects, func(p) { p.owner == caller });
    if (myProjects.size() == 0) {
      return 0;
    };
    for (proj in myProjects.vals()) {
      totalViews += proj.views;
    };
    if (totalViews == 0) {
      Debug.print("cashOutAllProjects: no views to cash out for " # Principal.toText(caller));
      return 0;
    };
    var newProjects = Array.map<Project, Project>(
      projects,
      func(p) {
        if (p.owner == caller) {
          { id = p.id; owner = p.owner; views = 0; contact = p.contact };
        } else {
          p;
        };
      },
    );
    projects := newProjects;

    let e8sToTransfer = totalViews * REWARD_PER_VIEW;
    let e8s64 = Nat64.fromNat(e8sToTransfer);
    Debug.print(
      "cashOutAllProjects: transferring " # Nat.toText(e8sToTransfer)
      # " e8s to " # Principal.toText(caller)
    );

    let args : TransferArgs = {
      to_principal = caller;
      to_subaccount = null;
      amount = { e8s = e8s64 };
    };

    let transferResult : TransferResult = await TransferBackend.transfer(args);
    switch (transferResult) {
      case (#Ok(blockIndex)) {
        let msgText = "cashOutAllProjects: paid " # Nat.toText(e8sToTransfer)
        # " e8s, totalViews=" # Nat.toText(totalViews)
        # ", blockIndex=" # Nat64.toText(blockIndex);
        logAction("cashOutAllProjects", msgText, caller);
        totalViews;
      };
      case (#Err(errMsg)) {
        let revertProjects = Array.map<Project, Project>(
          projects,
          func(p) {
            if (p.owner == caller) {
              let oldProjOpt = Array.find<Project>(myProjects, func(mp) { mp.id == p.id });
              switch (oldProjOpt) {
                case null { p };
                case (?oldp) {
                  {
                    id = oldp.id;
                    owner = oldp.owner;
                    views = oldp.views;
                    contact = oldp.contact;
                  };
                };
              };
            } else {
              p;
            };
          },
        );
        projects := revertProjects;
        Debug.print("cashOutAllProjects error: " # errMsg);
        logAction("cashOutAllProjects", "Error: " # errMsg, caller);
        0;
      };
    };
  };

  public shared func getAdById(adId : Nat) : async ?Ad {
    for (i in Iter.range(0, ads.size() - 1)) {
      if (ads[i].id == adId) {
        return ?ads[i];
      };
    };
    null;
  };

  public shared func getAllAds() : async [Ad] {
    ads;
  };

  public shared func getProjectById(projectId : Text) : async ?Project {
    for (i in Iter.range(0, projects.size() - 1)) {
      if (projects[i].id == projectId) {
        return ?projects[i];
      };
    };
    null;
  };

  public shared func getAllProjects() : async [Project] {
    projects;
  };

  public shared (msg) func getTotalActiveAds() : async Nat {
    let user = msg.caller;
    Array.foldLeft<Ad, Nat>(
      ads,
      0,
      func(acc, ad) {
        if (ad.advertiser == user and ad.viewsServed < ad.viewsPurchased) {
          acc + 1;
        } else {
          acc;
        };
      },
    );
  };

  public shared (msg) func getTotalViewsForProject(projectId : Text) : async Nat {
    let user = msg.caller;
    let idxOpt = findProjectPosition(projects, func(p) { p.id == projectId and p.owner == user });
    switch (idxOpt) {
      case null { 0 };
      case (?i) { projects[i].views };
    };
  };

  public shared (msg) func getTotalViewsForAllProjects() : async Nat {
    let user = msg.caller;
    let userProjects = Array.filter<Project>(projects, func(p) { p.owner == user });
    Array.foldLeft<Project, Nat>(userProjects, 0, func(acc, p) { acc + p.views });
  };

  public shared (msg) func getRemainingViewsForAd(adId : Nat) : async Nat {
    let user = msg.caller;
    let idxOpt = findAdPosition(ads, func(a) { a.id == adId and a.advertiser == user });
    switch (idxOpt) {
      case null { 0 };
      case (?i) {
        let ad = ads[i];
        if (ad.viewsPurchased > ad.viewsServed) {
          ad.viewsPurchased - ad.viewsServed;
        } else {
          0;
        };
      };
    };
  };

  public shared (msg) func getRemainingViewsForAllAds() : async Nat {
    let user = msg.caller;
    let userAds = Array.filter<Ad>(ads, func(a) { a.advertiser == user and a.viewsPurchased > a.viewsServed });
    Array.foldLeft<Ad, Nat>(
      userAds,
      0,
      func(acc, ad) { acc + (ad.viewsPurchased - ad.viewsServed) },
    );
  };

  public shared (msg) func deleteAd(adId : Nat) : async Bool {
    let caller = msg.caller;

    let idxOpt = findAdPosition(ads, func(x) { x.id == adId });
    switch (idxOpt) {
      case null {
        // No ad with that ID found
        return false;
      };
      case (?i) {
        let ad = ads[i];
        if (ad.advertiser != caller) {
          // The caller does not own this ad
          Debug.print("Unauthorized delete attempt by " # Principal.toText(caller));
          return false;
        } else {
          // Remove the ad from the ads array by skipping index i
          ads := Array.tabulate<Ad>(
            ads.size() - 1,
            func(j : Nat) : Ad {
              if (j < i) {
                ads[j];
              } else {
                ads[j + 1];
              };
            },
          );

          logAction(
            "deleteAd",
            "Deleted ad #" # Nat.toText(adId),
            caller,
          );
          return true;
        };
      };
    };
  };

  public query func verify_password(inputPassword : Text) : async Bool {
    inputPassword == storedPassword;
  };

  public shared func getLogs() : async [LogEntry] {
    logs;
  };
};
