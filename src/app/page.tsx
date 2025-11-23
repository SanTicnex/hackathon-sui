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

// --- CONFIGURACIÓN ---
const CONSTANTS = {
  WALLET_DAPP: process.env.NEXT_PUBLIC_WALLET_DAPP!,
  PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID!,
  MODULE: process.env.NEXT_PUBLIC_MODULE!,
  CLOCK_ID: process.env.NEXT_PUBLIC_CLOCK_ID!,
  ADMIN_CAP: process.env.NEXT_PUBLIC_ADMIN_CAP!,
  WHITELIST_ID: process.env.NEXT_PUBLIC_WHITELIST_ID!,
};

const getPropertyImage = (id: string) => {

  const floorplans = ["f14baf4e-6fef-4375-9484-6a0fdb3b0cd2", "add1cd80-270d-486e-865d-bd15c20fc6f2","0c4fd9c6-8711-4f1a-8e4c-cbcff5b0f34b"];

  // If an explicit id is provided, use it; otherwise pick a random floorplan id
 const imageId = floorplans[Math.floor(Math.random() * floorplans.length)];

  return `${process.env.NEXT_PUBLIC_BASE_IMAGE_URL}/${imageId}/medium.webp`;
};

export default function SuiEstateDApp() {
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

  // 1. Obtener Eventos (propiedades creadas)
  const {
    data: events,
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useSuiClientQuery("queryEvents", {
    query: {
      MoveModule: { package: CONSTANTS.PACKAGE_ID, module: CONSTANTS.MODULE },
    },
  });

  // 2. Obtener Mis Reservas
  const { data: myReservations, refetch: refetchReservations } =
    useSuiClientQuery("getOwnedObjects", {
      owner: account?.address || "",
      filter: {
        StructType: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULE}::Reservation`,
      },
      options: { showContent: true },
    });

  // 3. Obtener el objeto Whitelist (solo para mostrar su ID en la UI)
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

  // 1. Manejador para CREAR INMUEBLE (Firma del Cliente + Whitelist Check)
  const handleCreate = () => {
    if (!account) return alert("Conecta tu wallet para crear inmuebles.");

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
      return alert("Por favor, llena todos los campos correctamente.");
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
          alert("✅ ¡Inmueble Creado! Firma exitosa.");
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

          // Busca el código de aborto 5, que corresponde a "No autorizado/No en Whitelist"
          if (
            errorMessage.includes("Abort(") &&
            errorMessage.includes(", 5)")
          ) {
            alert(
              "🛑 ERROR de Permiso: Tu wallet no está en la Whitelist (código 5). Debes ser añadido por el Admin para crear propiedades.",
            );
          } else if (errorMessage.includes("EUnauthorized")) {
            alert(
              "🛑 ERROR de Permiso: Tu wallet no está en la Whitelist. Debes ser añadido para crear propiedades.",
            );
          } else {
            alert("Error de Transacción: " + errorMessage);
          }
        },
      },
    );
  };

  // 2. Manejador para AÑADIR PROMOTOR (Requiere AdminCap)
  const handleAddPromoter = () => {
    if (!account) return alert("Conecta tu wallet.");
    if (!newPromoterAddress || newPromoterAddress.length < 40)
      return alert("Ingresa una dirección Sui válida.");

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
          alert("✅ Promotor añadido. Digest: " + result.digest.slice(0, 6));
          setNewPromoterAddress("");
          refetchWhitelist();
          setIsAddingPromoter(false);
        },
        onError: (err) => {
          const errorMessage = err.message || JSON.stringify(err);
          let message = "Error desconocido de Transacción: " + errorMessage;

          // 1. 🚨 Detección del Error de Propiedad (El error que te está ocurriendo ahora)
          if (
            errorMessage.includes(
              "Transaction was not signed by the correct sender",
            ) &&
            errorMessage.includes(CONSTANTS.ADMIN_CAP)
          ) {
            message = `🛑 ERROR: Solo la wallet que posee el AdminCap (${CONSTANTS.ADMIN_CAP.slice(0, 10)}...) puede añadir promotores. Conecta la wallet correcta.`;
          }
          // 2. Detección de Error de Move (Si ya está en la lista)
          // Asumiendo que EAlreadyWhitelisted tiene un código de aborto, por ejemplo, 6.
          else if (
            errorMessage.includes("EAlreadyWhitelisted") ||
            (errorMessage.includes("Abort(") && errorMessage.includes(", 6)"))
          ) {
            message = "⚠️ Advertencia: La dirección ya está en la Whitelist.";
          }
          // 3. Detección de Error de Move (Si la wallet firmante no es el dueño del AdminCap)
          // Nota: Este error debería ser capturado por la detección de propiedad, pero se mantiene como fallback.
          else if (
            errorMessage.includes("EUnauthorized") ||
            (errorMessage.includes("Abort(") && errorMessage.includes(", 5)"))
          ) {
            message =
              "🛑 ERROR: La wallet firmante no posee la capacidad de administración (AdminCap).";
          }

          alert(message);
          setIsAddingPromoter(false);
        },
      },
    );
  };

  // 3. Manejador para RESERVAR
  const handleReserve = (propertyId: string) => {
    if (!account) return alert("Conecta tu wallet");
    const tx = new Transaction();
    // 1 SUI = 1,000,000,000 MIST. Asumiendo que el precio es en MIST
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
          alert("¡Reserva Exitosa!");
          refetchReservations();
        },
        onError: (err) => {
          const errorMessage = err.message || JSON.stringify(err);
          let message = "Error: " + errorMessage;

          // 🚨 Detección del Error 3 (Fondos Insuficientes)
          if (
            errorMessage.includes("Abort(") &&
            errorMessage.includes(", 3)")
          ) {
            message =
              "🛑 ERROR de Saldo: No tienes suficiente SUI en tu wallet para cubrir el precio de la reserva (código de error 3).";
          }
          // 🚨 Detección de Falla en SplitCoins (similar a saldo insuficiente)
          else if (errorMessage.includes("Insufficient coin balance")) {
            message =
              "🛑 ERROR de Saldo: Tu moneda de gas (SUI) no tiene suficiente saldo para la reserva.";
          }

          alert(message);
        },
      },
    );
  };

  // 4. Manejador para FINALIZAR/CANCELAR RESERVA
  const handleManageReservation = (
    action: "finalize_reservation" | "cancel_reservation",
    reservationObj: any,
  ) => {
    const tx = new Transaction();
    const fields =
      reservationObj.content?.fields || reservationObj.data?.content?.fields;
    if (!fields) return alert("Error leyendo datos");
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
              ? "¡Compra Finalizada!"
              : "Reserva Cancelada",
          );
          refetchReservations();
          refetchEvents(); // Opcional: para que se actualice el estado de la propiedad
        },
        onError: (err) => alert("Error: " + err.message),
      },
    );
  };

  // --- RENDERIZADO (JSX) ---

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

  // --- EFECTO PARA CARGAR LOS OBJETOS DE PROPIEDAD COMPLETOS ---
  useEffect(() => {
    if (events?.data && events.data.length > 0 && suiClient) {
      // 1. Filtrar y obtener los IDs de todos los eventos PropertyCreated
      const propertyIds = events.data
        .filter((ev: any) => ev.type.includes("PropertyCreated"))
        .map((ev: any) => ev.parsedJson.property_id);

      // 2. Si hay IDs, obtener los objetos completos
      if (propertyIds.length > 0) {
        suiClient
          .multiGetObjects({
            ids: propertyIds,
            options: { showContent: true, showType: true },
          })
          .then((objects) => {
            // Filtrar solo los objetos que se cargaron correctamente
            const validProperties = objects.filter(
              (obj) =>
                obj.data !== null &&
                obj.data.content?.dataType === "moveObject",
            );

            // Mapear los objetos para exponer los campos internos
            const structuredProperties = validProperties.map((obj) => ({
              // Metadatos de Sui (ID, versión)
              id: obj.data?.objectId,
              // Contenido de la estructura Move (name, price, bedrooms, etc.)
              ...obj.data?.content?.fields,
            }));

            // 3. Actualizar el estado de la UI
            setProperties(structuredProperties);
          })
          .catch((error) => {
            console.error(
              "Error al obtener detalles de las propiedades:",
              error,
            );
          });
      } else {
        setProperties([]);
      }
    } else if (!loadingEvents) {
      // Si la carga terminó y no hay eventos, limpiar las propiedades
      setProperties([]);
    }
  }, [events, suiClient, loadingEvents]); // Dependencias para que se ejecute al cambiar

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 text-slate-900">
      {/* FONDO DECORATIVO */}
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
                <ShoppingBag className="w-4 h-4 mr-2" /> Mercado
              </TabsTrigger>
              <TabsTrigger
                value="my-reservations"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                hidden={
                  whiteList.includes(account?.address ?? "") ||
                  account?.address === CONSTANTS.WALLET_DAPP
                }
              >
                <Key className="w-4 h-4 mr-2" /> Mis Reservas
              </TabsTrigger>
              <TabsTrigger
                value="admin-create"
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                hidden={
                  !whiteList.includes(account?.address ?? "") ||
                  account?.address === CONSTANTS.WALLET_DAPP
                }
              >
                <Home className="w-4 h-4 mr-2" /> Crear inmueble
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
                <p>Buscando propiedades en la red...</p>
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
                      {/* Imagen de cabecera */}
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={bgImage}
                          alt="House"
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        {property.state === 0 && (
                          <Badge className="absolute top-3 right-3 bg-green-600 text-white hover:bg-green-300 shadow-sm">
                            Disponible
                          </Badge>
                        )}
                        {property.state === 1 && (
                          <Badge className="absolute top-3 right-3 bg-blue-600 text-white hover:bg-blue-300 shadow-sm">
                            En reserva
                          </Badge>
                        )}
                        {property.state === 2 && (
                          <Badge className="absolute top-3 right-3 bg-slate-600 text-white hover:bg-slate-300 shadow-sm">
                            Vendido
                          </Badge>
                        )}
                      </div>

                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              {property.name || "Villa de Lujo"}
                            </CardTitle>
                            <div className="flex items-center text-slate-400 text-xs mt-1">
                              <MapPin className="w-3 h-3 mr-1" />{" "}
                              {property.physical_address ||
                                "Ubicación desconocida"}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-blue-600">
                              {property.price || "0"} MIST
                            </p>
                            <p className="text-xs text-slate-400">Reserva</p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pb-4">
                        <div className="flex gap-4 text-sm text-slate-600">
                          <div className="flex items-center">
                            <BedDouble className="w-4 h-4 mr-1 text-blue-500" />{" "}
                            {property.bedrooms || 2} Habs
                          </div>
                          <div className="flex items-center">
                            <Bath className="w-4 h-4 mr-1 text-blue-500" />{" "}
                            {property.bathrooms || 1} Baños
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 truncate">
                          Promotor:{" "}
                          <span className="font-mono bg-slate-100 p-1 rounded">
                            {property.promoter.slice(0, 10)}...
                          </span>
                        </div>
                      </CardContent>

                      {property.state !== 2 && (
                        <CardFooter className="bg-slate-50 pt-4">
                          {" "}
                          {isOwnedByCurrentUser ? (
                            // Opción 1: Es el propietario. Oculta el botón.
                            <div className="w-full text-center py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg">
                              <Wallet className="w-4 h-4 mr-2 inline" /> Es tu
                              Propiedad
                            </div>
                          ) : (
                            // Opción 2: No es el propietario (o no está conectado), muestra el botón Reservar.
                            <Button
                              className="w-full bg-slate-900 hover:bg-blue-600 transition-colors"
                              onClick={() => handleReserve(property.id.id)}
                            >
                              Reservar Propiedad{" "}
                            </Button>
                          )}{" "}
                        </CardFooter>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* --- TAB: MIS RESERVAS --- */}
          <TabsContent
            value="my-reservations"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={whiteList.includes(account?.address ?? "")}
          >
            {!account ? (
              notConnectedView(
                "Wallet no conectada",
                "Conecta tu wallet para ver tus reservas activas.",
              )
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {myReservations?.data.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500">
                      No tienes reservas activas. ¡Ve al mercado!
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
                            Reserva Confirmada
                          </h3>
                          <p className="text-sm text-slate-500 font-mono">
                            ID: {res.data.objectId.slice(0, 8)}...
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Activa
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 my-4 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs">
                            Propiedad Vinculada
                          </p>
                          <p className="font-medium text-slate-700 font-mono">
                            {res.data.content.fields.property_id.slice(0, 12)}
                            ...
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Expira el</p>
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
                          ✅ Finalizar Compra
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
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* --- TAB: ADMIN - CREAR INMUEBLE (Client-Signed con Whitelist Check) --- */}
          <TabsContent
            value="admin-create"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={!whiteList.includes(account?.address ?? "")}
          >
            {!account ? (
              notConnectedView(
                "Panel de Creación",
                "Conecta tu wallet para acceder al formulario de registro de inmuebles.",
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* Sidebar simple */}
                <div className="md:col-span-1 space-y-4">
                  <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <h3 className="font-bold text-slate-800">
                        Estado de Promotor
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      Para publicar, tu cuenta debe estar en la **Whitelist**.
                      La transacción la firmas tú, y pagas el gas.
                    </p>
                    <div className="text-xs bg-slate-50 p-3 rounded border border-slate-100 break-all text-slate-400">
                      ID de Whitelist: {CONSTANTS.WHITELIST_ID.slice(0, 10)}...
                    </div>
                  </div>
                </div>

                {/* Formulario */}
                <Card className="md:col-span-2 border-slate-200 shadow-md">
                  <CardHeader>
                    <CardTitle>Publicar Nueva Propiedad</CardTitle>
                    <CardDescription>
                      Ingresa los datos del activo inmobiliario.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre del Inmueble</Label>
                      <Input
                        id="name"
                        placeholder="Ej. Penthouse Moderno"
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
                          Nombre del promotor
                        </Label>
                        <Input
                          id="promoterName"
                          placeholder="Ej. Danube"
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
                        <Label htmlFor="projectId">Id del proyecto</Label>
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
                        <Label htmlFor="projectName">Nombre del projecto</Label>
                        <Input
                          id="projectName"
                          placeholder="Ej. Mercedes"
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
                        <Label htmlFor="currency">Moneda</Label>
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
                        <Label htmlFor="price">Precio (MIST)</Label>
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
                        <Label htmlFor="physical_address">Ubicación</Label>
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
                          Esperando Firma...
                        </>
                      ) : (
                        <>
                          <Home className="w-4 h-4 mr-2" /> Crear Inmueble
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* --- TAB: GESTIÓN DE WHITELIST --- */}
          <TabsContent
            value="admin-whitelist"
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            hidden={account?.address !== CONSTANTS.WALLET_DAPP}
          >
            {!account ? (
              notConnectedView(
                "Panel de Whitelist",
                "Conecta la wallet que posee el AdminCap para gestionar la lista de promotores.",
              )
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {" "}
                {/* <--- Añadido space-y-6 aquí para separar elementos */}
                <Card className="border-slate-200 shadow-md">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-slate-500" /> Gestión de
                      Whitelist
                    </CardTitle>
                    <CardDescription>
                      Añade wallets que tendrán permiso para crear nuevos
                      inmuebles. Solo el poseedor del AdminCap puede realizar
                      esta acción.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* SECCIÓN 1: FORMULARIO PARA AÑADIR */}
                    <div className="grid gap-2">
                      <Label htmlFor="promoter-address">
                        Dirección del Promotor a Añadir
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
                              <UserPlus className="w-4 h-4 mr-1" /> Añadir
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* SECCIÓN 2: LISTADO DE PROMOTORES AÑADIDO AQUÍ 👇 */}
                    <Card className="shadow-none border border-slate-200">
                      <CardHeader className="border-b border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                          <List className="w-5 h-5 mr-2 text-slate-500" />
                          Promotores en Whitelist ({whiteList.length})
                        </h3>
                        <CardDescription>
                          Direcciones autorizadas para crear propiedades.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {loadingPromoters ? (
                          <div className="flex items-center justify-center py-6 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Cargando lista de promotores...
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
                            No hay promotores registrados en la Whitelist.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    {/* FIN DEL LISTADO DE PROMOTORES 👆 */}

                    {/* SECCIÓN 3: REQUISITO DE AUTORIDAD (MANTENER) */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm">
                      <h4 className="font-semibold text-blue-800 flex items-center mb-2">
                        <Key className="w-4 h-4 mr-2" />
                        Requisito de Autoridad
                      </h4>
                      <p className="text-blue-700">
                        La transacción debe ser firmada por la dirección que
                        posee el objeto **AdminCap** (`
                        {CONSTANTS.ADMIN_CAP.slice(0, 10)}...`).
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-500">
                      Estado del Objeto Whitelist:{" "}
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
