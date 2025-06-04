// This is a generated Motoko binding.
// Please use `import service "ic:canister_id"` instead to call canisters on the IC if possible.

module {
  public type Result = { #Ok : Nat64; #Err : Text };
  public type Tokens = { e8s : Nat64 };
  public type TransferArgs = {
    to_principal : Principal;
    to_subaccount : ?Blob;
    amount : Tokens;
  };
  public type Self = actor {
    canister_account : shared query () -> async Blob;
    transfer : shared TransferArgs -> async Result;
  }
}