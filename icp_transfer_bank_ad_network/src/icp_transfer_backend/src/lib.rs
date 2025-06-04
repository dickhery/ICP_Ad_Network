use candid::{CandidType, Principal};
use ic_cdk_macros::*;
use ic_ledger_types::{
    AccountIdentifier, BlockIndex, Memo, Subaccount, Tokens, DEFAULT_SUBACCOUNT,
    MAINNET_LEDGER_CANISTER_ID,
};
use serde::{Deserialize, Serialize};

// If you really do want to restrict calls to a certain canister (the ad network canister?):
const ALLOWED_CALLER: &str = "qanay-uyaaa-aaaag-qbbwa-cai";  // Example

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TransferArgs {
    amount: Tokens,
    to_principal: Principal,
    to_subaccount: Option<Subaccount>,
}

#[update]
async fn transfer(args: TransferArgs) -> Result<BlockIndex, String> {
    let caller = ic_cdk::api::caller();

    // Optional check: Is caller the expected canister?
    if caller != Principal::from_text(ALLOWED_CALLER).map_err(|_| "Invalid allowed caller principal".to_string())? {
        return Err("Not authorized: caller is not the Ad Network canister.".to_string());
    }

    ic_cdk::println!(
        "Authorized transfer request from {}. Transferring {} tokens to principal {} subaccount {:?}",
        caller,
        &args.amount,
        &args.to_principal,
        &args.to_subaccount
    );

    let to_subaccount = args.to_subaccount.unwrap_or(DEFAULT_SUBACCOUNT);

    let transfer_args = ic_ledger_types::TransferArgs {
        memo: Memo(0),
        amount: args.amount,
        fee: Tokens::from_e8s(10_000),  // 0.0001 ICP
        from_subaccount: None,
        to: AccountIdentifier::new(&args.to_principal, &to_subaccount),
        created_at_time: None,
    };

    // This calls the real mainnet ledger
    // If you do not have real ICP on your canister’s account, it will fail or show zero balance.
    ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args)
        .await
        .map_err(|e| format!("failed to call ledger: {:?}", e))?
        .map_err(|e| format!("ledger transfer error {:?}", e))
}

// Export Candid
ic_cdk::export_candid!();
