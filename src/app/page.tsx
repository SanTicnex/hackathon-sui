"use client";

import { useEffect, useState } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReservationModal } from "@/components/reservation-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Home,
  Key,
  ShoppingBag,
  Loader2,
  MapPin,
  BedDouble,
  Bath,
  Wallet,
  Lock,
  Plus,
  List,
  UserPlus,
} from "lucide-react";

// --- CONFIGURATION ---
const CONSTANTS = {
  WALLET_DAPP: process.env.NEXT_PUBLIC_WALLET_DAPP!,
  PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID!,
  MODULE: process.env.NEXT_PUBLIC_MODULE!,
  CLOCK_ID: process.env.NEXT_PUBLIC_CLOCK_ID!,
  ADMIN_CAP: process.env.NEXT_PUBLIC_ADMIN_CAP!,
  WHITELIST_ID: process.env.NEXT_PUBLIC_WHITELIST_ID!,
};

const getPropertyImage = (id: string) => {
  const floorplans = ["cc2c1ac4365b82095824ad0440550c92", "7cc6d46f2c468f5b1d3dfdf23770c667","90c31d84077e7b6837a82024d54f2169"];

  // If an explicit id is provided, use it; otherwise pick a random floorplan id
  const imageId = floorplans[Math.floor(Math.random() * floorplans.length)];

  return `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/${imageId}.jpg`;
};

export default function SuiEstateDApp() {
  const [isReservationModalOpen, setReservationModalOpen] = useState(false);
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending: isSigning } =
    useSignAndExecuteTransaction();

  const [formData, setFormData] = useState({
    name: "",
    projectId: "",
    projectName: "",
    promoterName: "",
    price: "",
    currency: "",
    bedrooms: "",
    bathrooms: "",
    physical_address: "",
    floorplans: "",
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [newPromoterAddress, setNewPromoterAddress] = useState("");
  const [isAddingPromoter, setIsAddingPromoter] = useState(false);

  // --- QUERIES ---

  // 1. Get Events (Created Properties)
  const {
    data: events,
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useSuiClientQuery("queryEvents", {
    query: {
      MoveModule: { package: CONSTANTS.PACKAGE_ID, module: CONSTANTS.MODULE },
    },
  });

  // 2. Get My Reservations
  const { data: myReservations, refetch: refetchReservations } =
    useSuiClientQuery("getOwnedObjects", {
      owner: account?.address || "",
      filter: {
        StructType: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::Reservation`,
      },
      options: { showContent: true },
    });

  // 3. Get Whitelist Object (to show ID and content in UI)
  const { data: whitelistObject, refetch: refetchWhitelist } =
    useSuiClientQuery("getObject", {
      id: CONSTANTS.WHITELIST_ID,
      options: { showContent: true },
    });
  const tableId =
    whitelistObject?.data?.content?.fields?.allowed_promoters?.fields?.id?.id;
  const { data: promotersData, isLoading: loadingPromoters } =
    useSuiClientQuery(
      "getDynamicFields",
      {
        parentId: tableId || "0x0",
      },
      {
        enabled: !!tableId,
      },
    );
  const whiteList = promotersData?.data?.map((field) => field.name.value) || [];

  // --- HANDLERS ---

  // 1. Handler to CREATE PROPERTY (Client Signature + Whitelist Check)
  const handleCreate = () => {
    if (!account) return alert("Connect your wallet to create properties.");

    if (
      !formData.name ||
      !formData.price ||
      !formData.physical_address ||
      !formData.projectName ||
      !formData.bathrooms ||
      !formData.bedrooms ||
      !formData.physical_address ||
      !formData.promoterName ||
      !formData.currency ||
      Number(formData.price) <= 0
    ) {
      return alert("Please fill in all fields correctly.");
    }

    const tx = new Transaction();

    tx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::create_property`,
      arguments: [
        tx.object(CONSTANTS.WHITELIST_ID),
        tx.pure.address(account.address),
        tx.pure.string(formData.name),
        tx.pure.string(formData.projectName),
        tx.pure.string(formData.promoterName),
        tx.pure.u64(Number(formData.price)),
        tx.pure.string(formData.currency),
        tx.pure.u8(Number(formData.bedrooms)),
        tx.pure.u8(Number(formData.bathrooms)),
        tx.pure.string(formData.physical_address),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert("✅ Property Created! Signed successfully.");
          setFormData({
            name: "",
            projectId: "",
            projectName: "",
            promoterName: "",
            price: "",
            currency: "",
            bedrooms: "",
            bathrooms: "",
            physical_address: "",
            floorplans: "",
          });
          setTimeout(() => refetchEvents(), 1000);
        },
        onError: (err) => {
          const errorMessage = err.message || JSON.stringify(err);

          // Look for abort code 5, corresponding to "Unauthorized/Not Whitelisted"
          if (
            errorMessage.includes("Abort(") &&
            errorMessage.includes(", 5)")
          ) {
            alert(
              "🛑 PERMISSION ERROR: Your wallet is not on the Whitelist (code 5). You must be added by the Admin to create properties.",
            );
          } else if (errorMessage.includes("EUnauthorized")) {
            alert(
              "🛑 PERMISSION ERROR: Your wallet is not on the Whitelist. You must be added to create properties.",
            );
          } else {
            alert("Transaction Error: " + errorMessage);
          }
        },
      },
    );
  };

  // 2. Handler to ADD PROMOTER (Requires AdminCap)
  const handleAddPromoter = () => {
    if (!account) return alert("Connect your wallet.");
    if (!newPromoterAddress || newPromoterAddress.length < 40)
      return alert("Enter a valid Sui address.");

    setIsAddingPromoter(true);

    const tx = new Transaction();

    tx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::add_promoter`,
      arguments: [
        tx.object(CONSTANTS.ADMIN_CAP),
        tx.object(CONSTANTS.WHITELIST_ID),
        tx.pure.address(newPromoterAddress),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          alert("✅ Promoter added. Digest: " + result.digest.slice(0, 6));
          setNewPromoterAddress("");
          refetchWhitelist();
          setIsAddingPromoter(false);
        },
        onError: (err) => {
          const errorMessage = err.message || JSON.stringify(err);
          let message = "Unknown Transaction Error: " + errorMessage;

          // 1. 🚨 Property Error Detection (Current error)
          if (
            errorMessage.includes(
              "Transaction was not signed by the correct sender",
            ) &&
            errorMessage.includes(CONSTANTS.ADMIN_CAP)
          ) {
            message = `🛑 ERROR: Only the wallet holding the AdminCap (${CONSTANTS.ADMIN_CAP.slice(0, 10)}...) can add promoters. Connect the correct wallet.`;
          }
          // 2. Move Error Detection (Already whitelisted)
          // Assuming EAlreadyWhitelisted has an abort code, e.g., 6.
          else if (
            errorMessage.includes("EAlreadyWhitelisted") ||
            (errorMessage.includes("Abort(") && errorMessage.includes(", 6)"))
          ) {
            message = "⚠️ Warning: The address is already whitelisted.";
          }
          // 3. Move Error Detection (Signer not AdminCap owner)
          // Note: This should be caught by property detection, but kept as fallback.
          else if (
            errorMessage.includes("EUnauthorized") ||
            (errorMessage.includes("Abort(") && errorMessage.includes(", 5)"))
          ) {
            message =
              "🛑 ERROR: The signing wallet does not possess admin capability (AdminCap).";
          }

          alert(message);
          setIsAddingPromoter(false);
        },
      },
    );
  };

  // 3. Handler to RESERVE
  const handleReserve = (propertyId: string) => {
    if (!account) return alert("Connect your wallet");
    const tx = new Transaction();
    // 1 SUI = 1,000,000,000 MIST. Assuming price is in MIST
    const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(10000)]);
    tx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::create_reservation`,
      arguments: [
        tx.object(propertyId),
        payment,
        tx.object(CONSTANTS.CLOCK_ID),
      ],
    });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert("Reservation Successful!");
          refetchReservations();
        },
        onError: (err) => {
          const errorMessage = err.message || JSON.stringify(err);
          let message = "Error: " + errorMessage;

          // 🚨 Error 3 Detection (Insufficient Funds)
          if (
            errorMessage.includes("Abort(") &&
            errorMessage.includes(", 3)")
          ) {
            message =
              "🛑 BALANCE ERROR: You do not have enough SUI in your wallet to cover the reservation price (error code 3).";
          }
          // 🚨 SplitCoins Failure Detection
          else if (errorMessage.includes("Insufficient coin balance")) {
            message =
              "🛑 BALANCE ERROR: Your gas coin (SUI) has insufficient balance for the reservation.";
          }

          alert(message);
        },
      },
    );
  };

  // 4. Handler to FINALIZE/CANCEL RESERVATION
  const handleManageReservation = (
    action: "finalize_reservation" | "cancel_reservation",
    reservationObj: any,
  ) => {
    const tx = new Transaction();
    const fields =
      reservationObj.content?.fields || reservationObj.data?.content?.fields;
    if (!fields) return alert("Error reading data");
    const propertyId = fields.property_id;
    const reservationId =
      reservationObj.objectId || reservationObj.data?.objectId;

    tx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::${action}`,
      arguments: [tx.object(propertyId), tx.object(reservationId)],
    });
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          alert(
            action === "finalize_reservation"
              ? "Purchase Finalized!"
              : "Reservation Cancelled",
          );
          refetchReservations();
          refetchEvents(); // Optional: update property state
        },
        onError: (err) => alert("Error: " + err.message),
      },
    );
  };

  // --- RENDER (JSX) ---

  const notConnectedView = (title: string, desc: string) => (
    <div className="max-w-lg mx-auto mt-8 text-center p-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
      <div className="bg-slate-200 p-4 rounded-full inline-block mb-4">
        <Lock className="w-10 h-10 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 mb-6">{desc}</p>
      <div className="flex justify-center">
        <ConnectButton className="!bg-blue-600 !text-white hover:!bg-blue-700" />
      </div>
    </div>
  );

  // --- EFFECT TO LOAD FULL PROPERTY OBJECTS ---
  useEffect(() => {
    if (events?.data && events.data.length > 0 && suiClient) {
      // 1. Filter and get IDs from all PropertyCreated events
      const propertyIds = events.data
        .filter((ev: any) => ev.type.includes("PropertyCreated"))
        .map((ev: any) => ev.parsedJson.property_id);

      // 2. If IDs exist, get full objects
      if (propertyIds.length > 0) {
        suiClient
          .multiGetObjects({
            ids: propertyIds,
            options: { showContent: true, showType: true },
          })
          .then((objects) => {
            // Filter only successfully loaded objects
            const validProperties = objects.filter(
              (obj) =>
                obj.data !== null &&
                obj.data.content?.dataType === "moveObject",
            );

            const structuredProperties = validProperties.map((obj) => ({
              id: obj.data?.objectId,
              ...obj.data?.content?.fields,
            }));

            // 3. Update UI state
            setProperties(structuredProperties);
          })
          .catch((error) => {
            console.error(
              "Error fetching property details:",
              error,
            );
          });
      } else {
        setProperties([]);
      }
    } else if (!loadingEvents) {
      // If loading finished and no events, clear properties
      setProperties([]);
    }
  }, [events, suiClient, loadingEvents]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 text-slate-900">
      {/* DECORATIVE BACKGROUND */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)] opacity-20"></div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/60 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/30">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Instant Reserver
              </h1>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Marbella Sui Move Hackathon 2025
              </span>
            </div>
          </div>
          <ConnectButton className="!bg-slate-900 !text-white hover:!bg-slate-800 transition-all" />
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-10 text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
            Instant Reserver
          </h2>
          <p className="text-slate-500 text-2xl max-w-2xl mx-auto">
            <span className="text-[#6db3ff] font-bold">SUI</span>-Powered Blockchain-Secure Instant Property Deposit
          </p>
        </div>

        <Tabs defaultValue="marketplace" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="flex w-full max-w-xl bg-slate-200/50 p-1">
              <TabsTrigger
                value="marketplace"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <ShoppingBag className="w-4 h-4 mr-2" /> Marketplace
              </TabsTrigger>
              <TabsTrigger
                value="my-reservations"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                hidden={
                  whiteList.includes(account?.address ?? "") ||
                  account?.address === CONSTANTS.WALLET_DAPP
                }
              >
                <Key className="w-4 h-4 mr-2" /> My Reservations
              </TabsTrigger>
              <TabsTrigger
                value="admin-create"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                hidden={
                  !whiteList.includes(account?.address ?? "") ||
                  account?.address === CONSTANTS.WALLET_DAPP
                }
              >
                <Home className="w-4 h-4 mr-2" /> Create Property
              </TabsTrigger>
              <TabsTrigger
                value="admin-whitelist"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                hidden={account?.address !== CONSTANTS.WALLET_DAPP}
              >
                <Lock className="w-4 h-4 mr-2" /> Whitelist
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- TAB: MARKETPLACE --- */}
          <TabsContent
            value="marketplace"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            {loadingEvents ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-2" />
                <p>Fetching properties from network...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property, index) => {
                  const bgImage = getPropertyImage(property.id.id);

                  const connectedAddress = account?.address?.toLowerCase();
                  const promoterAddress = property.promoter?.toLowerCase();

                  const isOwnedByCurrentUser =
                    connectedAddress &&
                    promoterAddress &&
                    connectedAddress === promoterAddress;

                  return (
                    <Card
                      key={index}
                      className="group overflow-hidden border-slate-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white"
                    >
                      {/* Header Image */}
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={bgImage}
                          alt="House"
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        {property.state === 0 && (
                          <Badge className="absolute top-3 right-3 bg-green-600 text-white hover:bg-green-300 shadow-sm">
                            Available
                          </Badge>
                        )}
                        {property.state === 1 && (
                          <Badge className="absolute top-3 right-3 bg-blue-600 text-white hover:bg-blue-300 shadow-sm">
                            Reserved
                          </Badge>
                        )}
                        {property.state === 2 && (
                          <Badge className="absolute top-3 right-3 bg-slate-600 text-white hover:bg-slate-300 shadow-sm">
                            Sold
                          </Badge>
                        )}
                      </div>

                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {property.name || "Luxury Villa"}
                            </CardTitle>
                            <div className="flex items-center text-slate-400 text-xs mt-1">
                              <MapPin className="w-3 h-3 mr-1" />{" "}
                              {property.physical_address ||
                                "Unknown Location"}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-blue-600">
                              {Number(property.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                            </p>
                            <p className="text-xs text-slate-400">Reservation</p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pb-4">
                        <div className="flex gap-4 text-sm text-slate-600">
                          <div className="flex items-center">
                            <BedDouble className="w-4 h-4 mr-1 text-blue-500" />{" "}
                            {property.bedrooms || 2} Beds
                          </div>
                          <div className="flex items-center">
                            <Bath className="w-4 h-4 mr-1 text-blue-500" />{" "}
                            {property.bathrooms || 1} Baths
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 truncate">
                          Promoter:{" "}
                          <span className="font-mono bg-slate-100 p-1 rounded">
                            {property.promoter.slice(0, 10)}...
                          </span>
                        </div>
                      </CardContent>

                      {property.state !== 2 && (
                        <CardFooter className="bg-slate-50 pt-4">
                          {" "}
                          {isOwnedByCurrentUser ? (
                            // Option 1: Is Owner. Hide button.
                            <div className="w-full text-center py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg">
                              <Wallet className="w-4 h-4 mr-2 inline" /> Your Property
                            </div>
                          ) : (
                            <>
                                <Button
                                  className="w-full bg-slate-900 hover:bg-blue-600 transition-colors"
                                  onClick={() => setReservationModalOpen(true)}
                                >
                                  Pre-reserve
                                </Button><ReservationModal
                                  isOpen={isReservationModalOpen}
                                  onClose={() => setReservationModalOpen(false)}
                                  onVerify={() => {} }
                                  onReserve={() => { handleReserve(property.id.id)} } /></>
                          )}{" "}
                        </CardFooter>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* --- TAB: MY RESERVATIONS --- */}
          <TabsContent
            value="my-reservations"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={whiteList.includes(account?.address ?? "")}
          >
            {!account ? (
              notConnectedView(
                "Wallet not connected",
                "Connect your wallet to view active reservations.",
              )
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {myReservations?.data.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500">
                      You have no active reservations. Go to the marketplace!
                    </p>
                  </div>
                )}
                {myReservations?.data.map((res: any) => (
                  <Card
                    key={res.data.objectId}
                    className="flex flex-col md:flex-row overflow-hidden border-l-4 border-l-blue-500 shadow-md"
                  >
                    <div className="bg-blue-50 p-6 flex items-center justify-center md:w-48">
                      <Key className="w-12 h-12 text-blue-500/50" />
                    </div>
                    <div className="flex-1 p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800">
                            Confirmed Reservation
                          </h3>
                          <p className="text-sm text-slate-500 font-mono">
                            ID: {res.data.objectId.slice(0, 8)}...
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Active
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 my-4 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs">
                            Linked Property
                          </p>
                          <p className="font-medium text-slate-700 font-mono">
                            {res.data.content.fields.property_id.slice(0, 12)}
                            ...
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Expires on</p>
                          <p className="font-medium text-slate-700">
                            {new Date(
                              Number(res.data.content.fields.expiration_date),
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 shadow-md shadow-green-200"
                          onClick={() =>
                            handleManageReservation(
                              "finalize_reservation",
                              res.data,
                            )
                          }
                        >
                          ✅ Finalize Purchase
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() =>
                            handleManageReservation(
                              "cancel_reservation",
                              res.data,
                            )
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* --- TAB: ADMIN - CREATE PROPERTY (Client-Signed with Whitelist Check) --- */}
          <TabsContent
            value="admin-create"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={!whiteList.includes(account?.address ?? "")}
          >
            {!account ? (
              notConnectedView(
                "Creation Panel",
                "Connect your wallet to access the property registration form.",
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* Simple Sidebar */}
                <div className="md:col-span-1 space-y-4">
                  <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <h3 className="font-bold text-slate-800">
                        Promoter Status
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      To publish, your account must be in the **Whitelist**.
                      You sign the transaction and pay gas.
                    </p>
                    <div className="text-xs bg-slate-50 p-3 rounded border border-slate-100 break-all text-slate-400">
                      Whitelist ID: {CONSTANTS.WHITELIST_ID.slice(0, 10)}...
                    </div>
                  </div>
                </div>

                {/* Form */}
                <Card className="md:col-span-2 border-slate-200 shadow-md">
                  <CardHeader>
                    <CardTitle>Publish New Property</CardTitle>
                    <CardDescription>
                      Enter the real estate asset details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Property Name</Label>
                      <Input
                        id="name"
                        placeholder="Ex. Modern Penthouse"
                        className="border-slate-300 focus-visible:ring-blue-500"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="grid gap-2">
                        <Label htmlFor="promoterName">
                          Promoter Name
                        </Label>
                        <Input
                          id="promoterName"
                          placeholder="Ex. Danube"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.promoterName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              promoterName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="projectId">Project ID</Label>
                        <Input
                          id="projectId"
                          type="number"
                          placeholder="12345"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.projectId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              projectId: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="projectName">Project Name</Label>
                        <Input
                          id="projectName"
                          placeholder="Ex. Mercedes"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.projectName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              projectName: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                          id="currency"
                          placeholder="USD"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currency: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="price">Price (MIST)</Label>
                        <Input
                          id="price"
                          type="number"
                          placeholder="1000"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="physical_address">Location</Label>
                        <Input
                          id="physical_address"
                          placeholder="Dubai, Dubai"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.physical_address}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              physical_address: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="bedrooms">Bedrooms</Label>
                        <Input
                          id="bedrooms"
                          type="number"
                          placeholder="2"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.bedrooms}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bedrooms: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bathrooms">Bathrooms</Label>
                        <Input
                          id="bathrooms"
                          type="number"
                          placeholder="3"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.bathrooms}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bathrooms: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="floorplans">Floorplans</Label>
                        <Input
                          id="floorplans"
                          placeholder="Example"
                          className="border-slate-300 focus-visible:ring-blue-500"
                          value={formData.floorplans}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              floorplans: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={handleCreate}
                      disabled={isSigning}
                      className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-lg shadow-md disabled:opacity-70"
                    >
                      {isSigning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                          Waiting for Signature...
                        </>
                      ) : (
                        <>
                          <Home className="w-4 h-4 mr-2" /> Create Property
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* --- TAB: WHITELIST MANAGEMENT --- */}
          <TabsContent
            value="admin-whitelist"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={account?.address !== CONSTANTS.WALLET_DAPP}
          >
            {!account ? (
              notConnectedView(
                "Whitelist Panel",
                "Connect the wallet holding the AdminCap to manage the promoter list.",
              )
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {" "}
                <Card className="border-slate-200 shadow-md">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-slate-500" /> Whitelist Management
                    </CardTitle>
                    <CardDescription>
                      Add wallets that will have permission to create new
                      properties. Only the AdminCap holder can perform
                      this action.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* SECTION 1: ADD FORM */}
                    <div className="grid gap-2">
                      <Label htmlFor="promoter-address">
                        Promoter Address to Add
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="promoter-address"
                          placeholder="0x..."
                          className="flex-1 border-slate-300 font-mono focus-visible:ring-blue-500"
                          value={newPromoterAddress}
                          onChange={(e) =>
                            setNewPromoterAddress(e.target.value)
                          }
                        />
                        <Button
                          onClick={handleAddPromoter}
                          disabled={isAddingPromoter || isSigning}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isAddingPromoter || isSigning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1" /> Add
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* SECTION 2: PROMOTER LIST */}
                    <Card className="shadow-none border border-slate-200">
                      <CardHeader className="border-b border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                          <List className="w-5 h-5 mr-2 text-slate-500" />
                          Whitelisted Promoters ({whiteList.length})
                        </h3>
                        <CardDescription>
                          Authorized addresses to create properties.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {loadingPromoters ? (
                          <div className="flex items-center justify-center py-6 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Loading promoter list...
                          </div>
                        ) : whiteList.length > 0 ? (
                          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {whiteList.map((address) => (
                              <div
                                key={String(address)}
                                className="bg-slate-50 text-slate-700 p-3 rounded-md text-sm font-mono break-all border border-slate-100 shadow-sm transition-shadow hover:shadow-md"
                              >
                                {String(address)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 italic py-4 text-center">
                            No promoters registered in the Whitelist.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    {/* END OF PROMOTER LIST */}

                    {/* SECTION 3: AUTHORITY REQUIREMENT */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm">
                      <h4 className="font-semibold text-blue-800 flex items-center mb-2">
                        <Key className="w-4 h-4 mr-2" />
                        Authority Requirement
                      </h4>
                      <p className="text-blue-700">
                        The transaction must be signed by the address holding
                        the **AdminCap** object (`
                        {CONSTANTS.ADMIN_CAP.slice(0, 10)}...`).
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-500">
                      Whitelist Object Status:{" "}
                      <span className="font-mono">
                        {whitelistObject?.data?.objectId?.slice(0, 10)}...
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}