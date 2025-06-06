/**************************************
 * index.js — for ic_ad_network_bundle.js
 **************************************/
import { Actor, HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { Principal } from "@dfinity/principal";

// === IMPORT YOUR AD NETWORK CANISTER ===
import {
  idlFactory as adNetIdl,
  canisterId as adNetCanisterId,
} from "./ad_network_canister.js";

// === IMPORT THE OFFICIAL ICP LEDGER CANISTER ===
import {
  idlFactory as ledgerIdl,
  canisterId as ledgerCanisterId,
} from "./ledger_canister.js";

export { AuthClient, Principal };

let adNetworkActor = null;
let ledgerActor = null;
let authClient = null;

export function getCurrentIdentity() {
  return authClient ? authClient.getIdentity() : null;
}

/** ========== AD NETWORK ACTOR SETUP ========== **/
export async function initActorUnauthenticated() {
  if (!adNetworkActor) {
    const agent = new HttpAgent({ host: "https://ic0.app", identity: undefined });
    adNetworkActor = Actor.createActor(adNetIdl, {
      agent,
      canisterId: adNetCanisterId,
    });
    window.adNetworkActor = adNetworkActor;
  }
}

export async function initActorWithPlug() {
  if (!window.ic || !window.ic.plug) {
    console.warn("Plug wallet not detected for Ad Network init.");
    return false;
  }
  await window.ic.plug.requestConnect({
    whitelist: [adNetCanisterId, ledgerCanisterId],
    host: "https://ic0.app",
  });
  adNetworkActor = await window.ic.plug.createActor({
    canisterId: adNetCanisterId,
    interfaceFactory: adNetIdl,
  });
  window.adNetworkActor = adNetworkActor;
  return true;
}

export async function initActorWithInternetIdentity() {
  if (!authClient) {
    authClient = await AuthClient.create();
    window.authClient = authClient;
  }
  if (await authClient.isAuthenticated()) {
    const identity = authClient.getIdentity();
    const agent = new HttpAgent({ identity, host: "https://ic0.app" });
    adNetworkActor = Actor.createActor(adNetIdl, {
      agent,
      canisterId: adNetCanisterId,
    });
    window.adNetworkActor = adNetworkActor;
    return;
  }
  return new Promise((resolve, reject) => {
    authClient.login({
      identityProvider: "https://identity.ic0.app",
      onSuccess: async () => {
        const identity = authClient.getIdentity();
        const agent = new HttpAgent({ identity, host: "https://ic0.app" });
        adNetworkActor = Actor.createActor(adNetIdl, {
          agent,
          canisterId: adNetCanisterId,
        });
        window.adNetworkActor = adNetworkActor;
        window.authClient = authClient;
        resolve();
      },
      onError: reject,
    });
  });
}

function checkAdNetworkActor() {
  if (!adNetworkActor) {
    throw new Error("Ad Network actor is not initialized. Call initActor first.");
  }
}

/** ========== OFFICIAL ICP LEDGER ACTOR ========== **/
let ledgerAgent = null;

async function createLedgerActorAnonymous() {
  ledgerAgent = new HttpAgent({ host: "https://ic0.app", identity: undefined });
  ledgerActor = Actor.createActor(ledgerIdl, {
    agent: ledgerAgent,
    canisterId: ledgerCanisterId,
  });
  window.ledgerActor = ledgerActor;
  return ledgerActor;
}

export async function initLedgerActorUnauthenticated() {
  if (!ledgerActor) {
    await createLedgerActorAnonymous();
  }
}

export async function initLedgerActorWithPlug() {
  if (!window.ic || !window.ic.plug) {
    console.warn("Plug wallet not found for ICP ledger.");
    return false;
  }
  await window.ic.plug.requestConnect({
    whitelist: [ledgerCanisterId],
    host: "https://ic0.app",
  });
  ledgerActor = await window.ic.plug.createActor({
    canisterId: ledgerCanisterId,
    interfaceFactory: ledgerIdl,
  });
  if (!ledgerActor) {
    throw new Error("Failed to create ICP Ledger actor via Plug.");
  }
  window.ledgerActor = ledgerActor;
  return true;
}

export async function initLedgerActorWithInternetIdentity() {
  if (!authClient) {
    authClient = await AuthClient.create();
    window.authClient = authClient;
  }
  if (await authClient.isAuthenticated()) {
    const identity = authClient.getIdentity();
    ledgerAgent = new HttpAgent({ identity, host: "https://ic0.app" });
    ledgerActor = Actor.createActor(ledgerIdl, {
      agent: ledgerAgent,
      canisterId: ledgerCanisterId,
    });
    window.ledgerActor = ledgerActor;
    return;
  }
  return new Promise((resolve, reject) => {
    authClient.login({
      identityProvider: "https://identity.ic0.app",
      onSuccess: async () => {
        const identity = authClient.getIdentity();
        ledgerAgent = new HttpAgent({ identity, host: "https://ic0.app" });
        ledgerActor = Actor.createActor(ledgerIdl, {
          agent: ledgerAgent,
          canisterId: ledgerCanisterId,
        });
        window.ledgerActor = ledgerActor;
        resolve();
      },
      onError: reject,
    });
  });
}

function checkLedgerActor() {
  if (!ledgerActor) {
    throw new Error("ICP Ledger actor not initialized.");
  }
}

// "balanceOf" and "transfer" for your official ledger calls:
export async function ledger_balanceOf(principal, subaccount) {
  checkLedgerActor();
  const account = {
    owner: principal,
    subaccount: subaccount ? [Array.from(subaccount)] : [],
  };
  return await ledgerActor.icrc1_balance_of(account);
}

export async function ledger_transfer({ fromSubaccount, toPrincipal, toSubaccount, amount }) {
  checkLedgerActor();
  const transferArg = {
    to: {
      owner: toPrincipal,
      subaccount: toSubaccount ? [Array.from(toSubaccount)] : [],
    },
    fee: [],
    memo: [],
    from_subaccount: fromSubaccount ? [Array.from(fromSubaccount)] : [],
    created_at_time: [],
    amount,
  };
  return await ledgerActor.icrc1_transfer(transferArg);
}

/** ========== AD NETWORK CANISTER CALLS ========== **/
export async function purchaseViews(adId, additionalViews) {
  checkAdNetworkActor();
  return await adNetworkActor.purchaseViews(BigInt(adId), BigInt(additionalViews));
}

export async function createAd(name, imageB64, clickUrl, views, adType) {
  checkAdNetworkActor();
  return await adNetworkActor.createAd(name, imageB64, clickUrl, BigInt(views), adType);
}

export async function cashOutProject(projectId) {
  checkAdNetworkActor();
  return await adNetworkActor.cashOutProject(projectId);
}

export async function cashOutAllProjects() {
  checkAdNetworkActor();
  return await adNetworkActor.cashOutAllProjects();
}

export async function registerProject(pid, contact) {
  checkAdNetworkActor();
  return await adNetworkActor.registerProject(pid, contact);
}

export async function verifyPassword(password) {
  checkAdNetworkActor();
  return await adNetworkActor.verify_password(password);
}

export async function getTotalActiveAds() {
  checkAdNetworkActor();
  return await adNetworkActor.getTotalActiveAds();
}

export async function getTotalViewsForProject(pid) {
  checkAdNetworkActor();
  return await adNetworkActor.getTotalViewsForProject(pid);
}

export async function getTotalViewsForAllProjects() {
  checkAdNetworkActor();
  return await adNetworkActor.getTotalViewsForAllProjects();
}

export async function getRemainingViewsForAd(adId) {
  checkAdNetworkActor();
  return await adNetworkActor.getRemainingViewsForAd(BigInt(adId));
}

export async function getRemainingViewsForAllAds() {
  checkAdNetworkActor();
  return await adNetworkActor.getRemainingViewsForAllAds();
}

export async function getAllAds() {
  checkAdNetworkActor();
  return await adNetworkActor.getAllAds();
}
export async function getAdById(adId) {
  checkAdNetworkActor();
  return await adNetworkActor.getAdById(BigInt(adId));
}
export async function getProjectById(projectId) {
  checkAdNetworkActor();
  return await adNetworkActor.getProjectById(projectId);
}
export async function getAllProjects() {
  checkAdNetworkActor();
  return await adNetworkActor.getAllProjects();
}
export async function getMyAdsLite() {
  checkAdNetworkActor();
  return await adNetworkActor.getMyAdsLite();
}

/** CHANGED: getNextAd => returns Option<tuple>. We handle as [ad, tokenId] or null. */
export async function getNextAd(projectId, adType) {
  checkAdNetworkActor();
  // The canister returns an Option of a tuple (Ad, Nat).
  // In JS, if it's null or empty array => return null
  const result = await adNetworkActor.getNextAd(projectId, adType);
  if (!result || result.length === 0) {
    return null;
  }
  // result[0] is the tuple
  const [ad, token] = result[0];
  return [ad, token];
}

/** recordViewWithToken => increments if 5s passed + valid token. */
export async function recordViewWithToken(tokenId) {
  checkAdNetworkActor();
  return await adNetworkActor.recordViewWithToken(BigInt(tokenId));
}

export async function deleteAd(adId) {
  checkAdNetworkActor();             // Make sure adNetworkActor is initialized
  return await adNetworkActor.deleteAd(BigInt(adId));
}