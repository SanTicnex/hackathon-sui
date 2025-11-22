module reserve::reserve {
    use std::string::{String};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::event;
    use sui::table::{Self, Table};

    // --- Constants of state ---
    const STATE_ENABLE: u8 = 0;
    const STATE_RESERVE: u8 = 1;
    const STATE_SOLD: u8 = 2;

    // --- Errores ---
    const EPropertyNoEnable: u64 = 1;
    const EReservationNoMatch: u64 = 2;
    const EInsufficientFunds: u64 = 3;
    const EInvalidState: u64 = 4;
    const EUnauthorized: u64 = 5;
    const EAlreadyWhitelisted: u64 = 6;

    // --- Structs (Objects) ---

    // 1. AdminCap: Control who can create properties
    public struct AdminCap has key, store {
        id: UID
    }

    // 2. Whitelist:Shared Object
    public struct Whitelist has key, store {
        id: UID,
        allowed_promoters: Table<address, bool> 
    }

    // 3. Property: Shared Object
    public struct Property has key, store {
        id: UID,
        promoter: address,
        name: String,
        projectName: String,
        promoterName: String,
        price: u64,
        currency: String,
        bedrooms: u8,
        bathrooms: u8,
        physical_address: String,
        state: u8,
        reservationDate: Option<u64> // Milliseconds
    }

    // 4. Reservation: Owned Object of the customer
    public struct Reservation has key, store {
        id: UID,
        property_id: ID,
        expiration_date: u64 // Milliseconds
    }

    // --- Events ---
    public struct PropertyCreated has copy, drop { property_id: ID, promoter: address }
    public struct PropertyReserved has copy, drop { property_id: ID, customer: address }
    public struct PropertySold has copy, drop { property_id: ID }

    // --- Functions ---

    // Init: It runs once when the package is published. It creates the AdminCap.
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };

        transfer::public_transfer(admin_cap, ctx.sender());

        let whitelist = Whitelist {
            id: object::new(ctx),
            allowed_promoters: table::new(ctx),
        };
        transfer::share_object(whitelist);
    }

    // Auxiliar function
    fun is_promoter_allowed(whitelist: &Whitelist, addr: address): bool {
        table::contains(&whitelist.allowed_promoters, addr)
    }

    // 1.1. Add a wallet to the whitelist
    public fun add_promoter(
        _: &AdminCap,
        whitelist: &mut Whitelist,
        new_promoter: address,
        _ctx: &mut TxContext
    ) {
        assert!(!is_promoter_allowed(whitelist, new_promoter), EAlreadyWhitelisted);

        table::add(&mut whitelist.allowed_promoters, new_promoter, true);
    }

    // 1. Created property
    public fun create_property(
        whitelist: &Whitelist,
        promoter: address,
        name: String,
        projectName: String,
        promoterName: String,
        price: u64,
        currency: String,
        bedrooms: u8,
        bathrooms: u8,
        physical_address: String,
        ctx: &mut TxContext
    ) {
        assert!(is_promoter_allowed(whitelist, tx_context::sender(ctx)), EUnauthorized);

        let id = object::new(ctx);
        let property_id = object::uid_to_inner(&id);

        let property = Property {
            id,
            promoter,
            name,
            projectName,
            promoterName,
            price,
            currency,
            bedrooms,
            bathrooms,
            physical_address,
            state: STATE_ENABLE,
            reservationDate: option::none()
        };

        event::emit(PropertyCreated { property_id, promoter });

        transfer::share_object(property);
    }

    // 2. Created reservation
    public fun create_reservation(
        property: &mut Property,
        fee: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(property.state == STATE_ENABLE, EPropertyNoEnable);

        assert!(coin::value(&fee) >= 10000, EInsufficientFunds); 

        property.state = STATE_RESERVE;
        property.reservationDate = option::some(clock.timestamp_ms());

        let reservation = Reservation {
            id: object::new(ctx),
            property_id: object::uid_to_inner(&property.id),
            expiration_date: clock.timestamp_ms() + 86400000
        };

        event::emit(PropertyReserved { 
            property_id: object::uid_to_inner(&property.id), 
            customer: ctx.sender() 
        });

        transfer::public_transfer(fee, property.promoter);
        transfer::public_transfer(reservation, ctx.sender());
    }

    // 3. End reservation
    public fun finalize_reservation(
        property: &mut Property,
        reservation: Reservation,
        _ctx: &mut TxContext
    ) {
        assert!(object::uid_to_inner(&property.id) == reservation.property_id, EReservationNoMatch);
        assert!(property.state == STATE_RESERVE, EInvalidState);

        let Reservation { id, property_id: _, expiration_date: _ } = reservation;
        object::delete(id);

        property.state = STATE_SOLD;

        event::emit(PropertySold { 
            property_id: object::uid_to_inner(&property.id)
        });
    }

    // 4. Cancel reservation
    public fun cancel_reservation(
        property: &mut Property,
        reservation: Reservation,
        _ctx: &mut TxContext
    ) {
        assert!(object::uid_to_inner(&property.id) == reservation.property_id, EReservationNoMatch);
       
        let Reservation { id, property_id: _, expiration_date: _ } = reservation;
        object::delete(id);

        property.state = STATE_ENABLE;
        property.reservationDate = option::none();
    }
}