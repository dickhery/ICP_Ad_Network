
# Ad Network Transfer Bank Canister

![License](https://img.shields.io/github/license/dickhery/ad-network-transfer-bank)

## Overview

The **Ad Network Transfer Bank Canister** is a specialized **financial handler** for the ICP Ad Network. It is responsible for securely transferring **ICP rewards** to project owners who display ads, based on **genuine ad views tracked by the Ad Network Canister**.

This canister acts as the **official treasury for payouts**, connecting directly to the **mainnet ICP Ledger Canister (`ryjl3-tyaaa-aaaaa-aaaba-cai`)** to perform compliant ICRC-1 transfers.

---

## Key Features

✅ **Authorized Caller Only:** Transfers can only be triggered by the Ad Network Canister (`qanay-uyaaa-aaaag-qbbwa-cai`).  
✅ **Direct ICRC-1 Transfers:** Funds flow directly from this canister’s account to developers’ ICP wallets.  
✅ **Fixed Transfer Fee:** Applies the correct 0.0001 ICP fee for each transaction.  
✅ **Secure Ledger Integration:** Directly interacts with the official **ICP Ledger Canister**.  
✅ **Built with Rust:** Ensuring speed, safety, and compatibility with Internet Computer best practices.

---

## System Architecture

```text
+--------------------+
| Ad Network Canister |
| Tracks views,      |
| Calculates rewards |
+--------------------+
          |
          | Calls transfer() when payouts are due
          V
+-------------------------+
| Transfer Bank Canister  |
| Executes ICP transfers  |
| Enforces security       |
+-------------------------+
          |
          | Sends transfer request
          V
+---------------------+
| ICP Ledger Canister |
| Executes ICRC-1 Tx  |
+---------------------+
```

---

## Prerequisites

Before deploying this canister, ensure:

✅ You have **DFX installed**.  
✅ You have **Rust installed** (for canister builds).  
✅ You have the **latest ICP Ledger files** (WASM & Candid).  
✅ You can fund the transfer bank canister with ICP.

---

## Setting Up & Deploying the Canister

### Step 1 - Clone the Repository
```bash
git clone https://github.com/dickhery/ad-network-transfer-bank.git
cd ad-network-transfer-bank
```

---

### Step 2 - Add Ledger Canister to `dfx.json`

Edit your `dfx.json` to include:

```json
{
    "canisters": {
        "icp_transfer_backend": {
            "type": "rust",
            "package": "icp_transfer_backend",
            "candid": "src/icp_transfer_backend/icp_transfer_backend.did"
        },
        "icp_ledger_canister": {
            "type": "custom",
            "candid": "https://raw.githubusercontent.com/dfinity/ic/<LATEST_REVISION>/rs/rosetta-api/icp_ledger/ledger.did",
            "wasm": "https://download.dfinity.systems/ic/<LATEST_REVISION>/canisters/ledger-canister.wasm.gz",
            "remote": {
                "id": {
                    "ic": "ryjl3-tyaaa-aaaaa-aaaba-cai"
                }
            }
        }
    }
}
```

---

### Step 3 - Start the Local Replica
```bash
dfx start --background --clean
```

---

### Step 4 - Set Up Minter Identity
Create a new identity to act as the "minting account" for local testing.
```bash
dfx identity new minter --storage-mode plaintext
dfx identity use minter
export MINTER_ACCOUNT_ID=$(dfx ledger account-id)
```

---

### Step 5 - Switch Back to Default Identity
```bash
dfx identity use default
export DEFAULT_ACCOUNT_ID=$(dfx ledger account-id)
```

---

### Step 6 - Deploy the Ledger Canister
```bash
dfx deploy icp_ledger_canister --argument "
  (variant {
    Init = record {
      minting_account = \"$MINTER_ACCOUNT_ID\";
      initial_values = vec {
        record {
          \"$DEFAULT_ACCOUNT_ID\";
          record { e8s = 10_000_000_000 : nat64 }
        }
      };
      send_whitelist = vec {};
      transfer_fee = opt record { e8s = 10_000 : nat64 };
      token_symbol = opt \"LICP\";
      token_name = opt \"Local ICP\";
    }
  })
"
```

---

### Step 7 - Deploy the Transfer Bank Canister
```bash
dfx deploy icp_transfer_backend
```

---

### Step 8 - Fund the Transfer Bank Canister
After deployment, the canister needs ICP to distribute.
```bash
TOKENS_TRANSFER_ACCOUNT_ID="$(dfx ledger account-id --of-canister icp_transfer_backend)"
TOKENS_TRANSFER_ACCOUNT_ID_BYTES="$(python3 -c 'print("vec{" + ";".join([str(b) for b in bytes.fromhex("'$TOKENS_TRANSFER_ACCOUNT_ID'")]) + "}")')"

dfx canister call icp_ledger_canister transfer "(record {
    to = ${TOKENS_TRANSFER_ACCOUNT_ID_BYTES};
    memo = 1;
    amount = record { e8s = 2_000_000_000 };
    fee = record { e8s = 10_000 };
})"
```

---

### Step 9 - Confirm Balance
```bash
dfx canister call icp_ledger_canister account_balance "(record { account = ${TOKENS_TRANSFER_ACCOUNT_ID_BYTES} })"
```

---

## API Reference

### Transfer (Only Ad Network Canister Can Call)

```rust
transfer(args: TransferArgs) -> Result<BlockIndex, String>
```

#### Parameters
| Field | Type | Description |
|---|---|---|
| amount | Tokens | Amount to transfer in e8s |
| to_principal | Principal | Recipient's principal |
| to_subaccount | Optional | Optional target subaccount |

#### Response
| Variant | Description |
|---|---|
| Ok | Block index if successful |
| Err | Error message if failed |

---

## Example Transfer Request
This call **must originate from the Ad Network Canister** (`qanay-uyaaa-aaaag-qbbwa-cai`):

```rust
let args = TransferArgs {
    amount: Tokens { e8s: 1_000_000 },
    to_principal: developerPrincipal,
    to_subaccount: None
};
let result = await TransferBackend.transfer(args);
```

---

## Security Considerations

- ✅ Caller Verification: Only `qanay-uyaaa-aaaag-qbbwa-cai` can call `transfer()`.
- ✅ Transactions to invalid addresses will fail automatically.
- ✅ Transaction fees are fixed to **0.0001 ICP**.
- ✅ Strongly recommend enabling **SNS governance** if fully decentralizing.
- ✅ Protect all query responses (if used in future enhancements).

---

## Error Messages

| Error | Meaning |
|---|---|
| Not authorized | Caller was not the Ad Network Canister |
| failed to call ledger | ICP Ledger unreachable |
| ledger transfer error | ICP Ledger rejected transfer (insufficient funds, bad address, etc.) |

---

## Best Practices

- **Fund the transfer canister in advance**.
- **Check balances regularly** to avoid insufficient funds during payout.
- **Monitor logs** for unauthorized call attempts.
- **Update ledger URLs** if running on different networks (local vs mainnet).

---

## Example Full Deployment Script

You could create a `deploy_all.sh` like this:

```bash
#!/bin/bash
set -e

dfx start --background --clean
dfx deploy icp_ledger_canister
dfx deploy icp_transfer_backend

TOKENS_TRANSFER_ACCOUNT_ID=$(dfx ledger account-id --of-canister icp_transfer_backend)
echo "Transfer Bank Canister Account: $TOKENS_TRANSFER_ACCOUNT_ID"

# Fund it (example amount)
dfx canister call icp_ledger_canister transfer "(record {
    to = $(python3 -c 'print("vec{" + ";".join([str(b) for b in bytes.fromhex("'"$TOKENS_TRANSFER_ACCOUNT_ID"'")]) + "}")');
    memo = 1;
    amount = record { e8s = 2_000_000_000 };
    fee = record { e8s = 10_000 };
})"

echo "Deployed and funded successfully!"
```

---

## License

This project is licensed under the **MIT License**.

---

## Contact

| Field | Value |
|---|---|
| Email | dickhery@gmail.com |
| GitHub | [dickhery](https://github.com/dickhery) |

