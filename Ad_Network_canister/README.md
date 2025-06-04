
# ICP Ad Network Canister

![License](https://img.shields.io/github/license/dickhery/ad-network-canister)

## Table of Contents

1. [Introduction](#introduction)
2. [Key Features](#key-features)
3. [Data Structures](#data-structures)
4. [Ephemeral Token System](#ephemeral-token-system)
5. [Payment Logic](#payment-logic)
6. [Public Methods: Detailed Reference](#public-methods-detailed-reference)
    - [createAd](#createad)
    - [getNextAd](#getnextad)
    - [recordViewWithToken](#recordviewwithtoken)
    - [registerProject](#registerproject)
    - [purchaseViews](#purchaseviews)
    - [cashOutProject](#cashoutproject)
    - [cashOutAllProjects](#cashoutallprojects)
    - [getMyAdsLite](#getmyadslite)
    - [getAllAds](#getallads)
    - [getAllProjects](#getallprojects)
    - [getLogs](#getlogs)
    - [getTotalViewsForProject](#gettotalviewsforproject)
    - [getTotalViewsForAllProjects](#gettotalviewsforallprojects)
    - [getRemainingViewsForAd](#getremainingviewsforad)
    - [getRemainingViewsForAllAds](#getremainingviewsforallads)
    - [deleteAd](#deletead)
    - [verify_password](#verify_password)
    - [Other Utility Methods](#other-utility-methods)
7. [How It Works (Step-by-Step Flow)](#how-it-works-step-by-step-flow)
8. [Integration With Front Ends (main.js Example)](#integration-with-front-ends-mainjs-example)
9. [Deployment](#deployment)
10. [Security Features](#security-features)
11. [Developer Tips](#developer-tips)
12. [Contributing](#contributing)
13. [License](#license)
14. [Contact](#contact)
15. [Conclusion](#conclusion)

---

## Introduction

The **ICP Ad Network Canister** provides a **fully on-chain advertising backend** for decentralized applications (dapps) on the **Internet Computer Protocol (ICP)**. It lets you:

- Create ads and pay for views using a standard ICRC-1 token ledger (e.g., ICP in an 8-decimal representation).  
- Serve ads to **registered projects** in a fair rotation.  
- Count views only if an ad has been continuously visible for **5 seconds**, ensuring advertisers pay for genuine engagement.  
- Track every ad impression on-chain, offering **transparency** and **auditable** records.  
- Reward project owners (dapp developers) with on-chain payments for every valid view.

---

## Key Features

- **Decentralized Ad Tracking**  
  Each ad impression is validated and logged on-chain, ensuring verifiable statistics.

- **Ephemeral Token System**  
  Protects against fake views by requiring a project to wait at least 5 seconds before confirming a view.

- **Fair Ad Rotation**  
  Ads are sorted (primarily ascending by Ad ID), ensuring each active ad gets a fair chance to be served.

- **ICRC-1 Ledger Integration**  
  Payments use an ICRC-1-compatible ledger canister. Advertisers pay the canister for views, and the canister pays out to the project owner.

- **Full Transparency**  
  On-chain logs (`getLogs`) record major actions like ad creation, view purchase, and cash-outs.

- **Flexible Ad Formats**  
  Ads can be stored in multiple formats (e.g., banners, full-screen portrait, full-screen landscape) via a simple text `adType` field.

---

## Data Structures

Below are the key data types used in the canister (`main.mo`):

### 1. `Ad`

```motoko
{
  id : Nat;
  advertiser : Principal;
  imageBase64 : Text;
  clickUrl : Text;
  viewsPurchased : Nat;
  viewsServed : Nat;
  adType : Text;
}
```

- **id** — Unique identifier (auto-incremented by the canister).  
- **advertiser** — Principal who created the ad.  
- **imageBase64** — Base64-encoded ad image.  
- **clickUrl** — Destination URL when a user clicks the ad.  
- **viewsPurchased** — Total views the advertiser has paid for.  
- **viewsServed** — Number of views already served.  
- **adType** — A descriptive string (e.g., `"Banner"`, `"Full Page Portrait"`, etc.).

### 2. `Project`

```motoko
{
  id : Text;
  owner : Principal;
  views : Nat;
  contact : Text;
}
```

- **id** — A unique string ID for the project (e.g., `"my_game_project"`).  
- **owner** — Principal who registered the project.  
- **views** — Number of verified ad views accumulated (awaiting payout).  
- **contact** — Contact info for the project owner.

### 3. `EphemeralRecord` (used for view verification)

```motoko
{
  tokenId : Nat;
  adId : Nat;
  projectId : Text;
  createdAt : Nat64;
  used : Bool;
}
```

- **tokenId** — One-time token ID generated when the project requests an ad.  
- **adId** — The corresponding ad ID.  
- **projectId** — The project ID that requested the ad.  
- **createdAt** — The timestamp (nanoseconds) when the token was generated.  
- **used** — Whether the token was used (view recorded) or not.

### 4. `LogEntry`

```motoko
{
  timestamp : Nat;
  caller : Principal;
  method : Text;
  details : Text;
}
```

- **timestamp** — Timestamp in nanoseconds, stored as Nat.  
- **caller** — The principal who triggered the action (e.g., created an ad, cashed out).  
- **method** — The name of the method being invoked.  
- **details** — Additional information, like ad ID or error messages.

---

## Ephemeral Token System

A critical component for **view validation**. When a project calls `getNextAd`, the canister returns an `(Ad, tokenId)` pair:

1. The front end **displays** the ad.  
2. A **5-second timer** is started.  
3. After at least 5 seconds, the front end calls `recordViewWithToken(tokenId)`.  
4. The canister checks:  
   - **Token not used**  
   - **Token is recent**  
   - **Time difference** (>= 5 seconds)  
5. If valid, the canister increments both:  
   - The project’s `views` count (earning them tokens)  
   - The ad’s `viewsServed` count (reducing the advertiser’s purchased view balance)

If `recordViewWithToken` is called too soon or reused, it fails, preventing fake or instant bot traffic from being counted.

---

## Payment Logic

This canister integrates with an **ICRC-1 token ledger** (see `TransferBackend` import). All monetary values in the canister are in “e8s” (where 1 ICP = 100,000,000 e8s).

- **Cost Per View** (`COST_PER_VIEW`) = 0.001 ICP (i.e., 100,000 e8s)  
- **Reward Per View** (`REWARD_PER_VIEW`) = 0.00071 ICP (i.e., 71,000 e8s)

> **Note:** The difference (0.001 - 0.00071 = 0.00029 ICP) accounts for network overhead, admin fees, or other use cases determined by the project. You can adjust these constants to reflect your specific tokenomics.

### Flow

1. **Advertiser** transfers tokens to the canister’s ledger subaccount to purchase `viewsPurchased`.  
2. **Canister** increments the `viewsPurchased` for the specified ad(s).  
3. **Project** accumulates `views` in the canister.  
4. **Project calls** `cashOutProject` or `cashOutAllProjects` to receive ICRC-1 tokens directly to their principal.

---

## Public Methods: Detailed Reference

Below is an overview of each public method in `main.mo`. Methods marked as **(shared)** are accessible via canister calls.

### `createAd`

**Signature:**
```motoko
public shared (msg) func createAd(
    imageBase64 : Text,
    clickUrl : Text,
    viewsToPurchase : Nat,
    adType : Text
) : async Nat
```

**Description:**  
Creates a new ad record in the canister’s stable storage.  

- **Parameters:**  
  - `imageBase64`: Base64-encoded string of the ad image  
  - `clickUrl`: The URL that the ad points to  
  - `viewsToPurchase`: Number of views the advertiser wants to initially purchase  
  - `adType`: A descriptive text category for the ad (e.g., `"Banner"`, `"Full Page"`, etc.)  

- **Returns:**  
  - `Nat` (the newly created ad ID)

**Notes:**  
1. The canister automatically assigns the ad an ID (`nextAdId`).  
2. You should ensure the advertiser has already **transferred** enough ICRC-1 tokens to the canister to cover `viewsToPurchase * COST_PER_VIEW`. (Your front end can manage this with a ledger call prior to `createAd`).

### `getNextAd`

**Signature:**
```motoko
public shared func getNextAd(projectId : Text, adType : Text) : async ?(Ad, Nat)
```

**Description:**  
Retrieves the next ad to display for a given project, returning `(Ad, tokenId)` if available.  

- **Parameters:**  
  - `projectId`: The ID of the project requesting an ad.  
  - `adType`: Filter for ads that match this format/type (e.g., `"Banner"`, `"Full Page Portrait"`, etc.).  

- **Returns:**  
  - **`?(Ad, Nat)`**: A tuple of the `Ad` object and an ephemeral `tokenId`. Returns `null` if no matching ads are available.  

**Notes:**  
1. The canister filters ads by `adType` and then sorts them by ascending ID.  
2. It **cycles** through ads so that each gets a fair rotation.  
3. It generates an ephemeral token record (`EphemeralRecord`) for the project with a unique `tokenId`.  

### `recordViewWithToken`

**Signature:**
```motoko
public shared (msg) func recordViewWithToken(tokenId : Nat) : async Bool
```

**Description:**  
Validates a previously issued **ephemeral token** to confirm a **real** ad view after 5+ seconds.

- **Parameters:**  
  - `tokenId`: The ephemeral token ID from `getNextAd`  

- **Returns:**  
  - **`Bool`** indicating success (`true`) or failure (`false`).  

**Logic Flow:**  
1. Checks the ephemeral record for the provided `tokenId`.  
2. Verifies the token has **not** been used and was **issued >=5 seconds** ago.  
3. If valid, it:  
   - Marks the token as used.  
   - Increments the ad’s `viewsServed`.  
   - Increments the project’s `views`.  

**Fail Conditions:**  
- Token does not exist.  
- Token is already used.  
- Less than 5 seconds have passed since token creation.  

### `registerProject`

**Signature:**
```motoko
public shared (msg) func registerProject(projectId : Text, contact : Text) : async Bool
```

**Description:**  
Registers a new project for ad hosting and tracking.  

- **Parameters:**  
  - `projectId`: A unique identifier for the project  
  - `contact`: Contact info for the project  

- **Returns:**  
  - **`Bool`**: `true` if successful, `false` if the project already exists.  

**Notes:**  
The caller becomes the `owner` of the new project. Each project can store how many **verified** views it has accumulated (`views` field).  

### `purchaseViews`

**Signature:**
```motoko
public shared (msg) func purchaseViews(adId : Nat, additionalViews : Nat) : async Bool
```

**Description:**  
Increments the `viewsPurchased` count for the specified ad.  

- **Parameters:**  
  - `adId`: The ID of the existing ad.  
  - `additionalViews`: How many extra views to purchase.  

- **Returns:**  
  - **`Bool`**: `true` if purchase succeeded (i.e., the ad belongs to the caller), otherwise `false`.  

**Notes:**  
Again, ensure the user has transferred enough tokens to the canister prior to calling.  

### `cashOutProject`

**Signature:**
```motoko
public shared (msg) func cashOutProject(projectId : Text) : async Nat
```

**Description:**  
Pays out the project’s accumulated **views** to the project owner’s principal in ICRC-1 tokens.  

- **Parameters:**  
  - `projectId`: The project to cash out.  

- **Returns:**  
  - **`Nat`**: Number of views that were successfully cashed out. Returns `0` if none.  

**Notes:**  
- If the project has `X` views, the canister calculates the total e8s = `X * REWARD_PER_VIEW`.  
- If the ledger transfer is successful, the project’s `views` are reset to zero. Otherwise, it reverts.  

### `cashOutAllProjects`

**Signature:**
```motoko
public shared (msg) func cashOutAllProjects() : async Nat
```

**Description:**  
A convenience method that **cashes out all** projects owned by the caller in one transaction.  

- **Returns:**  
  - **`Nat`**: The total number of views cashed out across all owned projects.  

### `getMyAdsLite`

**Signature:**
```motoko
public shared (msg) func getMyAdsLite() : async [AdLite]
```

**Description:**  
Returns a lightweight array of ads belonging to the caller.  

- **Returns:** An array of:
  ```motoko
  {
    id : Nat;
    advertiser : Principal;
    clickUrl : Text;
    viewsPurchased : Nat;
    viewsServed : Nat;
    adType : Text;
  }
  ```
  Use this for quick dashboards or overviews without pulling the entire base64 image data.

### `getAllAds`

**Signature:**
```motoko
public shared func getAllAds() : async [Ad]
```

**Description:**  
Returns **all** ads in storage, including image data. Primarily for administrative or debugging use.  

### `getAllProjects`

**Signature:**
```motoko
public shared func getAllProjects() : async [Project]
```

**Description:**  
Returns **all** registered projects. Also primarily for administrative or debugging use.  

### `getLogs`

**Signature:**
```motoko
public shared func getLogs() : async [LogEntry]
```

**Description:**  
Fetches a **full history** of major actions (ad creation, purchase, cash-outs, etc.) from the canister.  

### `getTotalViewsForProject`

**Signature:**
```motoko
public shared (msg) func getTotalViewsForProject(projectId : Text) : async Nat
```

**Description:**  
Gets the total **un-cashed** views for a specific project owned by the caller.  

### `getTotalViewsForAllProjects`

**Signature:**
```motoko
public shared (msg) func getTotalViewsForAllProjects() : async Nat
```

**Description:**  
Returns the sum of `views` across **all** projects owned by the caller.

### `getRemainingViewsForAd`

**Signature:**
```motoko
public shared (msg) func getRemainingViewsForAd(adId : Nat) : async Nat
```

**Description:**  
Returns how many **unserved** views remain for a particular ad.  

### `getRemainingViewsForAllAds`

**Signature:**
```motoko
public shared (msg) func getRemainingViewsForAllAds() : async Nat
```

**Description:**  
Returns the total **unserved** views across **all** ads for the caller.

### `deleteAd`

**Signature:**
```motoko
public shared (msg) func deleteAd(adId : Nat) : async Bool
```

**Description:**  
Allows the **ad owner** to permanently delete an ad from storage.  

- **Returns:**  
  - **`Bool`**: `true` if deletion was successful, `false` otherwise.  

### `verify_password`

**Signature:**
```motoko
public query func verify_password(inputPassword : Text) : async Bool
```

**Description:**  
Simple password check to gate certain features (e.g., beta testing).  

- **Returns:** `true` if `inputPassword` matches `storedPassword`, otherwise `false`.

> **Warning:** This is just a straightforward check in stable storage. For production usage, you may want a more secure authentication method.

### Other Utility Methods

- **`getAdById(adId : Nat) : async ?Ad`**: Looks up an Ad by ID.  
- **`getProjectById(projectId : Text) : async ?Project`**: Looks up a Project by ID.  
- **`getTotalActiveAds() : async Nat`**: Returns how many ads the caller has that still have remaining views.  

---

## How It Works (Step-by-Step Flow)

1. **Project Registration**  
   - A dapp calls `registerProject("myProject", "contact@example.com")`.  
   - The canister stores this under the calling principal.  

2. **Advertiser Buys Views & Creates an Ad**  
   - Advertiser transfers tokens (e.g., 0.1 ICP for 100 views) to the canister’s ledger subaccount.  
   - Advertiser calls `createAd(base64Image, "https://myproduct.com", 100, "Banner")`.  

3. **Project Requests an Ad**  
   - The dapp calls `getNextAd("myProject", "Banner")`.  
   - Canister returns `(adObject, tokenId)`.  

4. **Front End Displays the Ad**  
   - The front end starts a 5-second timer.  

5. **View Validation**  
   - After 5 seconds, front end calls `recordViewWithToken(tokenId)`.  
   - The canister verifies the ephemeral record, increments the project’s `views`, and increments the ad’s `viewsServed`.  

6. **Project Cashes Out**  
   - Project owner calls `cashOutProject("myProject")`.  
   - Canister transfers `views * REWARD_PER_VIEW` to the owner’s principal, then resets `views` to 0.  

7. **Logs & Auditing**  
   - Call `getLogs` to see an on-chain record of key events.

---

## Integration With Front Ends (`main.js` Example)

A sample front-end file [`main.js`](./main.js) is included in the repository, showcasing how you might:

- **Authenticate** via Plug or Internet Identity.  
- **Transfer** tokens using the ledger canister calls.  
- **Create Ads**, **fetch next ad**, and **record** the view after 5 seconds.  
- **Register** new projects.  
- **Purchase** additional views.  
- **Cash Out** project earnings.  

Key front-end steps:
1. **Initialize** the AdNetwork actor (anonymous or with Plug/II).  
2. **Check** user’s token balance.  
3. **Transfer** tokens to the canister if buying views.  
4. **Call** `createAd` or `purchaseViews`.  
5. **Serve** ads to a project by calling `getNextAd`; then after 5 seconds, `recordViewWithToken`.  
6. **Cashing out** project views with `cashOutProject` or `cashOutAllProjects`.  

The front end uses the ephemeral token system to ensure only **truly** displayed ads get counted.

---

## Deployment

**Local Setup using `dfx`:**

1. **Clone** the repo:
   ```bash
   git clone https://github.com/dickhery/ad-network-canister.git
   cd ad-network-canister
   ```
2. **Start** the local replica:
   ```bash
   dfx start --background
   ```
3. **Deploy** the canister:
   ```bash
   dfx deploy
   ```

After deployment, you can call the methods using `dfx canister call ad_network <method>` or from a front-end integration.

> **Note:** In the provided code, the canister references `import TransferBackend "canister:icp_transfer_backend";` which means you need a ledger-like canister named `icp_transfer_backend` in your `dfx.json`. Adjust accordingly if your ledger canister has a different name.

---

## Security Features

1. **Ephemeral Tokens Expire Quickly**  
   - The view must be recorded within a short timeframe, or it is invalid.  
2. **Payment via ICRC-1**  
   - Uses a well-established token standard for transfers.  
3. **On-Chain Logs**  
   - All major operations are recorded in `logs`, enhancing traceability.  
4. **View Delay**  
   - The 5-second wait requirement thwarts quick reload bots.  

---

## Developer Tips

- **Use `getMyAdsLite`** to avoid pulling large Base64 data for each ad.  
- **Cross-check ephemeral tokens** to ensure you only call `recordViewWithToken` exactly once after 5 seconds.  
- **Monitor `getTotalViewsForAllProjects`** to see how many views you can cash out at any time.  
- **Adjust `COST_PER_VIEW` and `REWARD_PER_VIEW`** in the `main.mo` to reflect your own tokenomics.  

---

## Contributing

Contributions are welcome!  
- Please see [CONTRIBUTING.md](./CONTRIBUTING.md) or open an issue/pull request on GitHub.  
- You can also reach out via [GitHub Issues](https://github.com/dickhery/ad-network-canister/issues).

---

## License

This project is licensed under the **MIT License**.  
See the [LICENSE](./LICENSE) file for details.

---

## Contact

| Method  | Details                                                            |
|---------|--------------------------------------------------------------------|
| Email   | dickhery@gmail.com                                            |
| GitHub  | [dickhery](https://github.com/dickhery)                           |
| Project | Coming Soon                                                       |

---

## Conclusion

The **ICP Ad Network Canister** offers a streamlined, **decentralized advertising solution** for dapps on the Internet Computer. By integrating this canister, you ensure:

- **Fair and transparent** ad delivery.  
- **Verified, on-chain** ad impressions.  
- **Seamless** monetization for your project(s).  
- **Straightforward** token-based payments and rewards.

Whether you are an advertiser looking for genuine engagement or a project owner seeking a reliable revenue stream, this canister can serve as the backbone of your **on-chain advertising** system. Give it a try, and enjoy the benefits of a truly decentralized ad network!