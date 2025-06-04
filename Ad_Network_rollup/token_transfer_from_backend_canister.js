// token_transfer_from_backend_canister.js

export const idlFactory = ({ IDL }) => {
  // The Rust canister expects:
  // {
  //   to_principal : principal;
  //   to_subaccount : opt [nat8];
  //   amount : record { e8s : nat64 };
  // }

  const Tokens = IDL.Record({ e8s: IDL.Nat64 });
  const TransferArgs = IDL.Record({
    to_principal: IDL.Principal,
    to_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    amount: Tokens,
  });
  const TransferResult = IDL.Variant({
    Ok: IDL.Nat64,
    Err: IDL.Text,
  });

  return IDL.Service({
    // So the method is "transfer(TransferArgs) -> TransferResult"
    transfer: IDL.Func([TransferArgs], [TransferResult], []),
  });
};

export const init = ({ IDL }) => {
  return [];
};

// IMPORTANT: Must match the actual deployed ID for "icp_transfer_backend"
export const canisterId = "j24mu-2qaaa-aaaal-aae5a-cai";
