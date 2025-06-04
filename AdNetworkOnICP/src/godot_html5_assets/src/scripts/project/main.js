/*********************************
 * main.js (Construct 3 front end)
 *********************************/

import {
  // AD network calls:
  initActorUnauthenticated,
  initActorWithPlug,
  initActorWithInternetIdentity,
  getCurrentIdentity,
  createAd,
  deleteAd,
  getNextAd,
  registerProject,
  cashOutProject,
  cashOutAllProjects,
  purchaseViews,
  getAllAds,
  getTotalActiveAds,
  getTotalViewsForProject,
  getTotalViewsForAllProjects,
  getRemainingViewsForAd,
  getRemainingViewsForAllAds,
  verifyPassword,
  getMyAdsLite,
  recordViewWithToken,   // << new
  // ICP Ledger
  initLedgerActorUnauthenticated,
  initLedgerActorWithPlug,
  initLedgerActorWithInternetIdentity,
  ledger_balanceOf,
  ledger_transfer,
  // Principals
  AuthClient,
  Principal
} from "./ic_ad_network_bundle.js";

let authMethod = null; // "Plug" | "InternetIdentity" | null
let runtimeGlobal;
let messageQueue = [];
let isDisplayingMessage = false;

// We assume 8 decimals for ICP
const DECIMALS = 8;

// NEW: We'll store the setTimeout ID in this variable
let adViewTimeoutId = null;

function stringifyWithBigInt(obj) {
  return JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function setStatusMessage(msg) {
  messageQueue.push(msg);
  displayNextMessage();
}
window.setStatusMessage = setStatusMessage;

async function displayNextMessage() {
  if (isDisplayingMessage) return;
  if (!messageQueue.length) return;
  isDisplayingMessage = true;
  const msg = messageQueue.shift();
  runtimeGlobal.globalVars.StatusMessage = msg;
  await new Promise((r) => setTimeout(r, 5000));
  runtimeGlobal.globalVars.StatusMessage = "";
  isDisplayingMessage = false;
  displayNextMessage();
}

self.copyPrincipal = async function () {
  try {
    const textToCopy = runtimeGlobal.globalVars.currentPrincipal;
    if (!textToCopy) {
      setStatusMessage("No Principal found to copy.");
      return;
    }
    await navigator.clipboard.writeText(textToCopy);
    setStatusMessage("Principal copied to clipboard!");
  } catch (err) {
    console.error("Copy to clipboard error:", err);
    setStatusMessage("Error copying to clipboard: " + err.message);
  }
};

/** =========== Anonymous init at startup =========== */
self.initAdNetworkActor = async function() {
  if (authMethod) {
    setStatusMessage(`Already authenticated with ${authMethod}.`);
    return;
  }
  try {
    await initActorUnauthenticated();
    runtimeGlobal.globalVars.AuthState = "Unauthenticated";
    setStatusMessage("AdNetwork Actor initialized anonymously.");

    await initLedgerActorUnauthenticated();
  } catch (err) {
    console.error(err);
    runtimeGlobal.globalVars.AuthState = "Unauthenticated";
    setStatusMessage("Error initializing AdNetwork: " + err.message);
  }
};

/** =========== Connect with Plug =========== */
self.initAdNetworkWithPlug = async function() {
  if (!runtimeGlobal) return;
  if (authMethod === "InternetIdentity") {
    setStatusMessage("Already authenticated with Internet Identity. Please log out first.");
    return;
  }
  try {
    const ok = await initActorWithPlug();
    if (!ok) {
      runtimeGlobal.globalVars.AuthState = "Unauthenticated";
      setStatusMessage("Plug not found or user refused (for Ad Network).");
      return;
    }
    const ledgerOk = await initLedgerActorWithPlug();
    if (!ledgerOk) {
      runtimeGlobal.globalVars.AuthState = "Unauthenticated";
      setStatusMessage("ICP Ledger with Plug not found or user refused.");
      return;
    }

    const plugPrincipal = await window.ic.plug.agent.getPrincipal();
    runtimeGlobal.globalVars.currentPrincipal = plugPrincipal.toText();
    runtimeGlobal.globalVars.AuthState = "Plug";
    authMethod = "Plug";

    setStatusMessage("AdNetwork + ICP Ledger both initialized via Plug!");
	self.cancelAdViewTimeout();
    await self.fetchTrackingData();
  } catch (err) {
    console.error(err);
    runtimeGlobal.globalVars.AuthState = "Unauthenticated";
    setStatusMessage("Error initializing with Plug: " + err.message);
  }
};

/** =========== Connect with Internet Identity =========== */
self.initAdNetworkWithII = async function() {
  if (!runtimeGlobal) return;
  if (authMethod === "Plug") {
    setStatusMessage("Already authenticated with Plug. Please log out first.");
    return;
  }
  try {
    await initActorWithInternetIdentity();
    await initLedgerActorWithInternetIdentity();
    const identity = getCurrentIdentity();
    if (identity && identity.getPrincipal) {
      const p = identity.getPrincipal();
      runtimeGlobal.globalVars.currentPrincipal = p.toText();
      runtimeGlobal.globalVars.AuthState = "InternetIdentity";
      authMethod = "InternetIdentity";

      setStatusMessage("AdNetwork + ICP Ledger both initialized via Internet Identity!");
	  self.cancelAdViewTimeout();
      await self.fetchTrackingData();
    } else {
      runtimeGlobal.globalVars.AuthState = "Unauthenticated";
      setStatusMessage("Error retrieving identity after login. Possibly not authenticated?");
    }
  } catch (err) {
    console.error(err);
    runtimeGlobal.globalVars.AuthState = "Unauthenticated";
    setStatusMessage("Error initializing with Internet Identity: " + err.message);
  }
};

/** =========== CREATE NEW AD =========== */
self.createNewAd = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const adTypeSelected = runtimeGlobal.globalVars.AdTypeInput || "";
    const url = runtimeGlobal.globalVars.AdClickUrlInput || "";
    const numViewsStr = runtimeGlobal.globalVars.AdViewsInput || "0";
    const views = parseFloat(numViewsStr) || 0;

    const singleB64 = runtimeGlobal.globalVars.AdBase64Input || "";
    const b64Portrait = runtimeGlobal.globalVars.AdBase64InputPortrait || "";
    const b64Landscape = runtimeGlobal.globalVars.AdBase64InputLandscape || "";
    const requiresTwo = (adTypeSelected === "Full Page" || adTypeSelected === "Banner");
    let costTokens = views * 0.001;
    if (requiresTwo) costTokens *= 2;
    const rawCost = BigInt(Math.round(costTokens * 10 ** DECIMALS));

    if (rawCost > 0n) {
      setStatusMessage(`Transferring ~${costTokens} ICP to canister...`);
      const canisterPID = "j24mu-2qaaa-aaaal-aae5a-cai"; // or your payment canister
      const tResult = await ledger_transfer({
        fromSubaccount: null,
        toPrincipal: Principal.fromText(canisterPID),
        toSubaccount: null,
        amount: rawCost,
      });
      if ("Err" in tResult) {
        setStatusMessage("Payment failed: " + JSON.stringify(tResult.Err));
        return;
      } else {
        setStatusMessage(`Payment of ${costTokens} ICP successful. Creating Ad(s)...`);
      }
    }

    if (requiresTwo) {
      if (!b64Portrait || !b64Landscape) {
        setStatusMessage("Please upload BOTH Portrait and Landscape images first!");
        return;
      }
      const adIdPortrait = await createAd(b64Portrait, url, views, adTypeSelected + " Portrait");
      const adIdLandscape = await createAd(b64Landscape, url, views, adTypeSelected + " Landscape");
      setStatusMessage(`Created two ads: ID #${adIdPortrait}, #${adIdLandscape}`);
      runtimeGlobal.globalVars.LastCreatedAdId = `Portrait: ${adIdPortrait}, Landscape: ${adIdLandscape}`;
      await self.checkTokenBalance();
    } else {
      if (!singleB64) {
        setStatusMessage("Please upload an image!");
        return;
      }
      const adId = await createAd(singleB64, url, views, adTypeSelected);
      runtimeGlobal.globalVars.LastCreatedAdId = adId;
      setStatusMessage("Created new Ad with ID: " + adId);
      await self.checkTokenBalance();
    }

    runtimeGlobal.globalVars.AdBase64Input = "";
    runtimeGlobal.globalVars.AdBase64InputPortrait = "";
    runtimeGlobal.globalVars.AdBase64InputLandscape = "";
    await self.fetchTrackingData();
	self.resetAllInputs();
  } catch (err) {
    console.error("createAd error:", err);
    setStatusMessage("Error creating ad: " + err.message);
  }
};

/**
 * =========== FETCH NEXT AD ===========
 * Returns [adObject, tokenId] or null. We'll wait 5 seconds to call recordViewWithToken.
 */
self.fetchNextAd = async function() {
  if (!runtimeGlobal) return;
  try {
    const pid = runtimeGlobal.globalVars.projectId;
    const adType = runtimeGlobal.globalVars.AdTypeInput || "";
    const result = await getNextAd(pid, adType);
    if (!result || result.length === 0) {
      setStatusMessage("No available ads (null).");
      runtimeGlobal.globalVars.CurrentAdBase64 = "";
      runtimeGlobal.globalVars.CurrentAdClickUrl = "";
      return;
    }
    const [ad, tokenId] = result;
    runtimeGlobal.globalVars.CurrentAdBase64 = ad.imageBase64;
    runtimeGlobal.globalVars.CurrentAdClickUrl = ad.clickUrl;
    setStatusMessage(`Fetched Ad #${ad.id} (served: ${ad.viewsServed}), token: ${tokenId}`);

    // NEW: If there's a leftover timer, clear it:
    if (adViewTimeoutId !== null) {
      clearTimeout(adViewTimeoutId);
      adViewTimeoutId = null;
    }

    // Start a new 5s timer
    adViewTimeoutId = setTimeout(async () => {
      try {
        const success = await recordViewWithToken(tokenId);
        if (success) {
          setStatusMessage(`View for Ad #${ad.id} counted (token ${tokenId}).`);
        } else {
          setStatusMessage(`View for Ad #${ad.id} was NOT counted (too soon or invalid).`);
        }
      } catch (err) {
        console.error("recordViewWithToken error:", err);
        setStatusMessage("Error recording ad view: " + err.message);
      }
      adViewTimeoutId = null; // done
    }, 5000);

  } catch (err) {
    console.error(err);
    setStatusMessage("fetchNextAd error: " + err.message);
  }
};

/** NEW: A function to cancel the pending ad view timeout. */
self.cancelAdViewTimeout = function() {
  if (adViewTimeoutId !== null) {
    clearTimeout(adViewTimeoutId);
    adViewTimeoutId = null;
    setStatusMessage("User left the layout before 5s. No recordView call will happen.");
  }
};

/** fetchMyAds etc. remain the same... */
self.fetchMyAds = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const userAds = await getMyAdsLite();
    runtimeGlobal.globalVars.MyAdsJson = stringifyWithBigInt(userAds);
    setStatusMessage(`Found ${userAds.length} ads for current user.`);
    self.populateMyAdsList();
  } catch (err) {
    console.error(err);
    setStatusMessage("Error fetching user’s ads: " + err.message);
  }
};

self.populateMyAdsList = function() {
  if (!runtimeGlobal) return;
  const listObj = runtimeGlobal.objects.List_MyAds
    ? runtimeGlobal.objects.List_MyAds.getFirstInstance()
    : null;
  if (!listObj) {
    console.log("List_MyAds not found in runtime objects.");
    return;
  }
  listObj.clear();
  const userAdsStr = runtimeGlobal.globalVars.MyAdsJson || "";
  if (!userAdsStr) {
    setStatusMessage("No user ads found.");
    return;
  }
  let userAds;
  try {
    userAds = JSON.parse(userAdsStr);
  } catch (e) {
    console.error("Failed to parse MyAdsJson:", e);
    setStatusMessage("Error parsing MyAdsJson: " + e.message);
    return;
  }
  userAds.forEach(ad => {
    const remainingViews = ad.viewsPurchased - ad.viewsServed;
    const itemText = `Ad #${ad.id} | Remaining Views: ${remainingViews}`;
    listObj.addItem(`${ad.id}|${itemText}`);
  });
};


/** =========== PURCHASE MORE VIEWS =========== */
self.topUpAdViews = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const adIdStr = runtimeGlobal.globalVars.AdIDInput;
    const additionalStr = runtimeGlobal.globalVars.AdViewsExtra;
    const additionalViews = parseInt(additionalStr, 10) || 0;
    const costTokens = additionalViews * 0.001;
    const rawCost = BigInt(Math.round(costTokens * 10 ** DECIMALS));
    if (rawCost > 0n) {
      setStatusMessage(`Transferring ${costTokens} ICP for additional views...`);
      const pid = "j24mu-2qaaa-aaaal-aae5a-cai"; 
      const tResult = await ledger_transfer({
        fromSubaccount: null,
        toPrincipal: Principal.fromText(pid),
        toSubaccount: null,
        amount: rawCost,
      });
      if ("Err" in tResult) {
        setStatusMessage("Transfer error: " + JSON.stringify(tResult.Err));
        return;
      }
    }
    const success = await purchaseViews(Number(adIdStr), additionalViews);
    if (success) {
      setStatusMessage(`Successfully topped up Ad #${adIdStr} with ${additionalViews} views.`);
      await self.checkTokenBalance();
	  self.resetAllInputs();
    } else {
      setStatusMessage(`purchaseViews() returned false. Possibly not your ad?`);
    }
  } catch (err) {
    console.error("topUpAdViews error:", err);
    setStatusMessage("Error purchasing additional views: " + err.message);
  }
};

/** =========== Official Ledger Transfer =========== */
self.transferTokens = async function () {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const toPrincipalStr = runtimeGlobal.globalVars.TokenRecipient;
    const toPrincipal = Principal.fromText(toPrincipalStr);
    const decimalAmount = parseFloat(runtimeGlobal.globalVars.TokenAmount) || 0;
    const rawAmount = BigInt(Math.round(decimalAmount * 10 ** DECIMALS));
    const result = await ledger_transfer({
      fromSubaccount: null,
      toPrincipal,
      toSubaccount: null,
      amount: rawAmount,
    });
    if ("Ok" in result) {
      setStatusMessage(`Transfer success! Block index: ${result.Ok}`);
      await self.checkTokenBalance();
    } else {
      setStatusMessage("Transfer error: " + stringifyWithBigInt(result.Err));
    }
  } catch (err) {
    console.error(err);
    setStatusMessage("Error transferring tokens: " + err.message);
  }
};

/** =========== Show user’s ICP balance from the ledger =========== */
self.checkTokenBalance = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const principalString = runtimeGlobal.globalVars.currentPrincipal;
    if (!principalString) {
      setStatusMessage("No principal found. Are you authenticated?");
      return;
    }
    const principal = Principal.fromText(principalString);
    const rawBal = await ledger_balanceOf(principal, null);
    const floatBal = Number(rawBal) / 10 ** DECIMALS;
    const displayBalance = floatBal.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: DECIMALS,
    });
    runtimeGlobal.globalVars.TokenBalance = displayBalance;
    setStatusMessage(`Balance: ${displayBalance} ICP`);
  } catch (err) {
    console.error("checkTokenBalance error:", err);
    setStatusMessage("Error checking token balance: " + err.message);
  }
};

/** =========== CASH OUT =========== */
self.cashOutProjectViews = async function(projectId) {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const views = await cashOutProject(projectId);
    if (views === 0) {
      setStatusMessage(`Project [${projectId}] has 0 views or not owned by you.`);
      return;
    }
    setStatusMessage(`Cash out success! Project [${projectId}] => cashed out ${views} views.`);
    await self.checkTokenBalance();
    await self.fetchTrackingData();
  } catch (err) {
    console.error("cashOutProjectViews error:", err);
    setStatusMessage("Error in cashOutProjectViews: " + err.message);
  }
};

self.cashOutAllProjectsViews = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const views = await cashOutAllProjects();
    if (views === 0) {
      setStatusMessage("No views to cash out or not the owner of any projects.");
      return;
    }
    setStatusMessage(`Cashed out ${views} total views across all your projects!`);
    await self.fetchTrackingData();
    await self.checkTokenBalance();
  } catch (err) {
    console.error("cashOutAllProjectsViews error:", err);
    setStatusMessage("Error in cashOutAllProjectsViews: " + err.message);
  }
};

/** =========== Misc =========== */
self.registerProjectInCanister = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    // Ensure the latest projectId is read from the input field
    runtimeGlobal.globalVars.projectId = runtimeGlobal.objects.TextInput_RegisterProjectId.getFirstInstance().text;

    const pid = runtimeGlobal.globalVars.projectId.trim();
    if (!pid) {
      setStatusMessage("Project ID cannot be empty.");
      return;
    }

    const contact = runtimeGlobal.globalVars.ProjectContactInput || "No contact provided";

    const ok = await registerProject(pid, contact);
    if (ok) {
      setStatusMessage(`Project "${pid}" registered successfully!`);
    } else {
      setStatusMessage(`Project "${pid}" already exists or failed.`);
    }
    
    await self.fetchTrackingData();
  } catch (err) {
    console.error("registerProject error:", err);
    setStatusMessage("Error registering project: " + err.message);
  }
};


self.handleImageSelection = async function(fileUrl, orientation = "") {
  if (!runtimeGlobal) return;
  try {
    const resp = await fetch(fileUrl);
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64Str = dataUrl.replace(/^data:.+;base64,/, "");
      if (orientation === "Portrait") {
        runtimeGlobal.globalVars.AdBase64InputPortrait = base64Str;
      } else if (orientation === "Landscape") {
        runtimeGlobal.globalVars.AdBase64InputLandscape = base64Str;
      } else {
        runtimeGlobal.globalVars.AdBase64Input = base64Str;
      }
      setStatusMessage("File chosen and converted to base64 successfully.");
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.error(err);
    setStatusMessage("Error converting file to base64: " + err.message);
  }
};

runOnStartup(async (runtime) => {
  runtimeGlobal = runtime;
  await self.initAdNetworkActor();
  setStatusMessage("Ad Network + ICP Ledger main.js loaded successfully.");
  await self.fetchTrackingData();
});

/** =========== fetchTrackingData =========== */
self.fetchTrackingData = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    // remain anonymous if you want
    return;
  }
  try {
    const userPrincipal = runtimeGlobal.globalVars.currentPrincipal;
    if (!userPrincipal) {
      return;
    }
    const totalActiveAds = await getTotalActiveAds();
    runtimeGlobal.globalVars.TotalActiveAds = totalActiveAds;

    const totalViewsAllProjects = await getTotalViewsForAllProjects();
    runtimeGlobal.globalVars.TotalViewsAllProjects = totalViewsAllProjects;

    const totalRemainingViews = await getRemainingViewsForAllAds();
    runtimeGlobal.globalVars.RemainingViewsAllAds = totalRemainingViews;

    setStatusMessage("Tracking data updated successfully.");
  } catch (err) {
    console.error("Error fetching tracking data:", err);
    setStatusMessage("Error fetching tracking data: " + err.message);
  }
};

/** fetchRemainingViewsForAd, fetchTotalViewsForProject, etc. are all unchanged. */
self.fetchRemainingViewsForAd = async function(adId) {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const remainingViews = await getRemainingViewsForAd(adId);
    runtimeGlobal.globalVars.RemainingViewsForAd = remainingViews;
    setStatusMessage(`Remaining views for Ad #${adId}: ${remainingViews}`);
  } catch (err) {
    console.error(err);
    setStatusMessage("Error fetching ad views: " + err.message);
  }
};

self.fetchTotalViewsForProject = async function(projectId) {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }
  try {
    const totalViews = await getTotalViewsForProject(projectId);
    runtimeGlobal.globalVars.TotalViewsForProject = totalViews;
    setStatusMessage(`Project "${projectId}" has ${totalViews} views.`);
  } catch (err) {
    console.error(err);
    setStatusMessage("Error fetching project views: " + err.message);
  }
};

self.logout = async function() {
  if (!runtimeGlobal) return;
  try {
    if (authMethod === "Plug") {
      if (window.ic && window.ic.plug) {
        await window.ic.plug.disconnect();
        window.adNetworkActor = null;
        window.ledgerActor = null;
      }
    } else if (authMethod === "InternetIdentity") {
      if (window.authClient) {
        await window.authClient.logout();
        window.adNetworkActor = null;
        window.ledgerActor = null;
      }
    }
    authMethod = null;
    runtimeGlobal.globalVars.AuthState = "Unauthenticated";
    runtimeGlobal.globalVars.currentPrincipal = "";
    setStatusMessage("Logged out successfully.");
	self.cancelAdViewTimeout();
  } catch (err) {
    console.error("Logout error:", err);
    setStatusMessage("Error during logout: " + err.message);
  }
};

self.resetAllInputs = function() {
  if (!runtimeGlobal) return;

  runtimeGlobal.globalVars.AdClickUrlInput = "";
  runtimeGlobal.globalVars.AdViewsInput = "";
  runtimeGlobal.globalVars.AdViewsExtra = "";
  runtimeGlobal.globalVars.AdBase64Input = "";
  runtimeGlobal.globalVars.AdBase64InputPortrait = "";
  runtimeGlobal.globalVars.AdBase64InputLandscape = "";
  runtimeGlobal.globalVars.SingleImageUploaded = false;
  runtimeGlobal.globalVars.PortraitVersionUploaded = false;
  runtimeGlobal.globalVars.LandscapeImageUploaded = false;
  runtimeGlobal.globalVars.AdTypeInput = "Choose Ad Type";

  const inputs = [
    'TextInput_AdClickUrlInput',
    'TextInput_AdViewsInput',
    'TextInput_AdViewsExtra'
  ];

  inputs.forEach(name => {
    const inputObj = runtimeGlobal.objects[name]?.getFirstInstance();
    if (inputObj) {
      inputObj.text = "";
    }
  });

  // Instead of using JavaScript directly, set a global variable:
  runtimeGlobal.globalVars.ResetAdTypeSelection = true;
};


self.deleteAd = async function() {
  if (!runtimeGlobal) return;
  if (!authMethod) {
    setStatusMessage("Please authenticate first.");
    return;
  }

  try {
    const rawValue = runtimeGlobal.globalVars.AdIDInput;
const adIdStr = rawValue != null ? String(rawValue) : "";

// Now check if it's empty
if (adIdStr.trim() === "") {
  setStatusMessage("No valid Ad ID found to delete.");
  return;
}

    setStatusMessage(`Attempting to delete Ad #${adIdStr}...`);
    const success = await deleteAd(adIdStr);

    if (success) {
      setStatusMessage(`Ad #${adIdStr} deleted successfully.`);
      // Re-fetch ads to update the UI
      await self.fetchMyAds();
    } else {
      setStatusMessage(`Failed to delete Ad #${adIdStr}. Possibly not your ad or not found.`);
    }
  } catch (err) {
    console.error("deleteAd error:", err);
    setStatusMessage("Error deleting ad: " + err.message);
  }
};



/* =======================
   NEW: Password Verification Function
   ======================= */

// Function to verify password and set isBetaTester
self.checkPassword = async function() {
  if (!runtimeGlobal) return;
  try {
    const inputPassword = runtimeGlobal.globalVars.UserInputPassword;
    const isValid = await verifyPassword(inputPassword);
    runtimeGlobal.globalVars.isBetaTester = isValid;
    if (isValid) {
      setStatusMessage("Password verified! Access granted.");
	  self.cancelAdViewTimeout();
    } else {
      setStatusMessage("Invalid password. Access denied.");
    }
  } catch (err) {
    console.error("Error verifying password:", err);
    setStatusMessage("Error verifying password: " + err.message);
  }
};
