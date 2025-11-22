module preregistration::euid_identity {
    use sui::clock;
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    const E_NOT_AUTHORIZED: u64 = 0;
    const AUTHORITY: address = @0xDEAD_BEEF; // TODO: replace with real backend address

    public struct VerifiedBuyer has key {
        id: UID,
        owner: address,
        vp_hash: vector<u8>,
        issued_at: u64,
        expires_at: u64,
    }

    public struct VerifiedBuyerCreated has copy, drop {
        owner: address,
        verified_object_id: ID,
        issued_at: u64,
        expires_at: u64,
    }

    public entry fun create_verified_buyer(
        recipient: address,
        vp_hash: vector<u8>,
        expires_at: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == AUTHORITY, E_NOT_AUTHORIZED);

        let issued_at = clock::now_ms();

        let verified = VerifiedBuyer {
            id: object::new(ctx),
            owner: recipient,
            vp_hash,
            issued_at,
            expires_at,
        };

        let verified_id = object::id(&verified);

        event::emit(VerifiedBuyerCreated {
            owner: recipient,
            verified_object_id: verified_id,
            issued_at,
            expires_at,
        });

        transfer::transfer(verified, recipient);
    }
}
