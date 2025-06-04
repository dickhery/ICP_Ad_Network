/****************************************************
 * index.js — minimal for ad-network-api.bundle.js
 ****************************************************/

import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as adNetIdl, canisterId as adNetCanisterId } from "./ad_network_canister.js";

// We'll store the adNetworkActor in a local var
let adNetworkActor = null;

/** initActorUnauthenticated: only for anonymous usage. */
export async function initActorUnauthenticated() {
  if (!adNetworkActor) {
    const agent = new HttpAgent({ host: "https://ic0.app", identity: undefined });
    adNetworkActor = Actor.createActor(adNetIdl, {
      agent,
      canisterId: adNetCanisterId,
    });
  }
}

/**
 * getNextAd: returns ?(Ad, Nat).
 * or if your canister returns ?Ad or ?(Ad), adapt accordingly.
 */
export async function getNextAd(projectId, adType) {
  if (!adNetworkActor) throw new Error("Actor not initialized!");
  // The canister returns an Option that might be (Ad, Nat).
  const result = await adNetworkActor.getNextAd(projectId, adType);
  // If it's Motoko ?(Ad, Nat), we must convert that from an array or null.
  if (!result || result.length === 0) {
    return null;
  }
  return result[0]; // e.g., [Ad, tokenId]
}

/**
 * recordViewWithToken: after 5s we call this to actually count the view.
 */
export async function recordViewWithToken(tokenId) {
  if (!adNetworkActor) throw new Error("Actor not initialized!");
  return await adNetworkActor.recordViewWithToken(tokenId);
}

// Expose them globally for your index.html
window.AdNetworkAPI = {
  initActorUnauthenticated,
  getNextAd,
  recordViewWithToken,
};
