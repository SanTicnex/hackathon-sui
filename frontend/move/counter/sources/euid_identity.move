module counter::euid_identity {
    use sui::event;    

    public struct VerifiedBuyer has key, store {
        id: UID,
        owner: address,
        vp_hash: vector<u8>,
        issued_at: u64,
        expires_at: u64,
    }

    public struct VerifiedBuyerCreated has copy, drop {
        verified_object_id: ID,
        issued_at: u64,
        expires_at: u64,
    }

    public fun create_verified_buyer(
        recipient: address,
        vp_hash: vector<u8>,
        expires_at: u64,
        ctx: &mut TxContext,
    ) {
        let issued_at = tx_context::epoch_timestamp_ms(ctx);
        let id = object::new(ctx);
        let verified_object_id = object::uid_to_inner(&id);
        let buyer = VerifiedBuyer {
            id,
            owner: recipient,
            vp_hash,
            issued_at,
            expires_at,
        };
        event::emit(VerifiedBuyerCreated {
            verified_object_id,
            issued_at,
            expires_at,
        });
        transfer::public_transfer(buyer, recipient);
    }
}