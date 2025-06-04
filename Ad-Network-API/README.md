

# ICP Ad Network API

![License](https://img.shields.io/github/license/dickhery/ad-network-api)
![Version](https://img.shields.io/github/package-json/v/dickhery/ad-network-api)

## Overview

The **ICP Ad Network API** allows developers to monetize their projects on the **Internet Computer (IC)** by embedding **ads fetched directly from the ICP Ad Network Canister**. Projects earn **ICP tokens** based on **genuine ad views**, ensuring fairness using a **5-second visibility rule**.

This ensures a **view only counts if the ad is displayed on screen for at least 5 seconds**. If the ad is removed, hidden, or the user navigates away before 5 seconds, the view **must not be recorded**.

---

## Table of Contents
- [Features](#features)
- [How It Works](#how-it-works)
- [5-Second View Rule](#5-second-view-rule)
- [Getting Started](#getting-started)
- [Step-by-Step Integration Guide](#step-by-step-integration-guide)
- [Minimal Example](#minimal-example)
- [Project Registration](#project-registration)
- [Available Ad Types](#available-ad-types)
- [Earning ICP](#earning-icp)
- [Technical Notes](#technical-notes)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Features

✅ Easy Integration into HTML, Construct 3, or other web apps  
✅ Automatic ICP Rewards for Valid Views  
✅ Ephemeral Token Security (one-time-use tokens)  
✅ Fraud Prevention (5-second enforced views)  
✅ Supports Different Ad Types & Sizes  
✅ Works Across All Modern Browsers

---

## How It Works

The **Ad Network Canister** serves ads and tracks views.

1. **Project Fetches Ad:** Your project requests an ad using its **Project ID**.
2. **Canister Issues Ephemeral Token:** Each ad comes with a **temporary token**.
3. **5-Second Timer:** You **must hold the ad visible on screen for 5 seconds** before recording the view.
4. **Record the View:** After 5 seconds, call `recordViewWithToken` with the token.  
5. **Cancel if Needed:** If the user navigates away before 5 seconds, do **not** record the view. The token becomes invalid automatically.

---

## ⏱️ 5-Second View Rule (Important!)

### Why?
To prevent abuse (like auto-refreshing ads in a loop), views only count if the **ad remains visible for a continuous 5-second period**.

### Implementation

- When you fetch an ad, the canister sends you a **token**.
- Start a **5-second timer** after displaying the ad.
- If the user navigates away, hides the ad, or switches layouts before 5 seconds, **discard the token**.
- Only if the ad stays visible for 5 seconds should you call:
    ```js
    await AdNetworkAPI.recordViewWithToken(tokenId);
    ```
- Calling before 5 seconds = rejected view.

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/dickhery/ad-network-api.git
cd ad-network-api
npm install
```

### 2. Build the Bundle
```bash
npm run build
```
This creates `dist/ad-network-api.bundle.js` — copy it into your project.

---

## Include in Your Project
Add this to your HTML:
```html
<script src="./js/ad-network-api.bundle.js"></script>
```

This exposes `AdNetworkAPI`, ready to use.

---

## Step-by-Step Integration Guide

### Step 1: Initialize Actor (Anonymous)

Before any ad calls:
```js
await AdNetworkAPI.initActorUnauthenticated();
```

---

### Step 2: Fetch Ad + Ephemeral Token
Call `getNextAd` with your **Project ID** and desired **ad type**:
```js
const [ad, tokenId] = await AdNetworkAPI.getNextAd("YourProjectID", "Horizontal Banner Portrait");
```

If no ads are available, you’ll get `null`.

---

### Step 3: Display Ad + Start 5-Second Timer
Show the ad in your UI:
```js
adImage.src = `data:image/png;base64,${ad.imageBase64}`;
adLink.href = ad.clickUrl;
```

Immediately after displaying, **start a timer**:
```js
const timer = setTimeout(() => {
    recordViewWithToken(tokenId);
}, 5000);
```

---

### Step 4: Handle Layout Changes (Ad Hidden)

If the user navigates away or the ad is removed from view **before the 5 seconds**, **cancel the timer** and discard the token:
```js
clearTimeout(timer);
```
In this case, **you must NOT call `recordViewWithToken`**. The view does not count.

---

### Step 5: Record View After 5 Seconds
If the ad stayed visible for 5 seconds:
```js
await AdNetworkAPI.recordViewWithToken(tokenId);
```

If the call succeeds, your project earns **ICP**.

---

## Minimal Example

Check [ad-network-api.html](./ad-network-api.html) for a **complete working demo**, including:

✅ Fetching ads  
✅ Displaying ads  
✅ Handling 5-second timer  
✅ Cancelling when user leaves  
✅ Recording valid views

---

## Project Registration (Critical Step)

### Before Fetching Ads
You **must register your project** with the Ad Network **once**.

### How to Register
1. Login to the Ad Network dapp.
2. Navigate to **Monetize Your Project**.
3. Enter a **Project ID** and contact information.
4. Click **Register Project**.

### Required for Every Ad Call
Every time you call `getNextAd`, you must pass:
```js
getNextAd("YourProjectID", "Horizontal Banner Portrait");
```
Without a registered project ID, the canister will **reject** the request.

---

## Available Ad Types

These types are supported:
- `"Horizontal Banner Portrait"`
- `"Full Page"`
- `"Vertical Banner"`
- `"Square"`

More types may be added in future versions.

---

## Earning ICP

✅ Every valid view adds to your project’s balance.  
✅ Views are converted to ICP when you **cash out** via the dapp’s dashboard.  
✅ Current rate: `0.00071 ICP per view`.

*(Subject to change based on network policies.)*

---

## Technical Notes

- **Ephemeral Tokens:**  
  Each token is unique and can only be used once after exactly 5 seconds.

- **Anonymous or Authenticated:**  
  You only need `initActorUnauthenticated()` to fetch ads. No login required.

- **Secure:**  
  Canister enforces 5-second wait using on-chain timestamps.

---

## Example: Full Ad Flow in Code
```js
await AdNetworkAPI.initActorUnauthenticated();

const [ad, tokenId] = await AdNetworkAPI.getNextAd("YourProjectID", "Horizontal Banner Portrait");

if (ad) {
    adImage.src = `data:image/png;base64,${ad.imageBase64}`;
    adLink.href = ad.clickUrl;

    let viewRecorded = false;

    const timer = setTimeout(async () => {
        await AdNetworkAPI.recordViewWithToken(tokenId);
        viewRecorded = true;
    }, 5000);

    window.addEventListener("beforeunload", () => {
        if (!viewRecorded) clearTimeout(timer);
    });
}
```

---

## Contributing

Contributions are welcome! Open issues or pull requests on [GitHub](https://github.com/dickhery/ad-network-api).

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

- Email: dickhery@gmail.com  
- GitHub: [dickhery](https://github.com/dickhery)

---

This README is **designed to ensure projects properly handle the 5-second view rule**. Properly following this guide helps protect the **ad network from fraud** and ensures your project gets fairly rewarded for **genuine ad views**.

