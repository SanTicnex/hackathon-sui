# Instant Reserve / SuiEstate

Una dApp de reserva inmobiliaria sobre Sui Blockchain con verificación de identidad integrada para la Sui Move Hackathon 2025.

## Elevator Pitch

- **Problema resuelto**: Las pre-ventas inmobiliarias necesitan flujos de reserva con **KYC/verificación de identidad** y **recibos on-chain** confiables.
- **Solución**: dApp sobre Sui que permite conectar wallet, verificar identidad (simulada vía EUDI/OpenID4VP) y hacer pre-reservas de propiedades representadas como NFTs.
- **Diferenciador**: Flujo de verificación al ~90% listo para conectar con backend real de identidad sin cambiar la UI.
- **Impacto**: Reduce fricción en el proceso de reserva, aumenta confianza con recibos blockchain y acelera ventas inmobiliarias.

## Arquitectura de la solución

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Backend KYC    │    │   Sui Blockchain │
│   (Next.js)     │◄──►│   (Identity)    │◄──►│  (Smart Contracts)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI/UX         │    │   Verificación  │    │   Propiedades   │
│   Modal Stepper │    │   de identidad  │    │   y Reservas    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Componentes principales

#### Frontend (Next.js)
- **Rama base**: `first-version` + integración KYC en `feature/first-version-kyc`
- **Tecnologías**: React, TypeScript, Tailwind CSS, ShadCN UI
- **Funcionalidades**:
  - Listado de propiedades con estado (Disponible/En reserva/Vendido)
  - Botón "Reservar Propiedad" con modal de pasos
  - **Modal con Stepper KYC**:
    - Paso 0: Verificar identidad
    - Paso 1: Confirmar pre-reserva
    - Paso 2: Ver estado de éxito
  - Panel de administración para promotores

#### Smart Contracts en Sui (Move)
- **Módulo**: `reserve::reserve`
- **Estructuras principales**:
  - `Property`: Objeto que representa cada inmueble
  - `ReservationTicket`: Owner Object para compradores
  - `AdminCap`: Capacidad de administración
  - `Whitelist`: Shared Object con promotores autorizados
- **Estados**: Disponible (0) → En Reserva (1) → Vendido (2)

#### Backend de identidad (`backend-identity`)
- **API REST** que simula/implementa el flujo EUDI/OpenID4VP
- **Endpoints principales**:
  - `POST /kyc/start`: Inicia sesión KYC
  - `GET /kyc/status/:suiAddress`: Consulta estado de verificación
- **Respuesta**: Devuelve si un address está verificado como `VerifiedBuyer`

## Flujo de usuario

1. El usuario abre Instant Reserve y ve las tarjetas de propiedades disponibles
2. Conecta su Sui Wallet mediante el botón de conexión
3. Selecciona una propiedad y pulsa "Reservar Propiedad"
4. Se abre un modal con **Stepper KYC de 3 pasos**:
   - **Paso 0**: "Verificar identidad" - Llama al backend de identidad
   - **Paso 1**: "Confirmar pre-reserva" - Muestra datos de la propiedad seleccionada
   - **Paso 2**: "Pre-reserva completada" - Muestra recibo y resumen
5. Opcional: El usuario puede finalizar la compra desde su panel de "Mis Reservas"

## Flujo técnico en Sui (objetos y contratos)

### Paso 0: Despliegue del contrato
- Se publica el paquete Move en testnet
- Se crea el `AdminCap` como Owner Object para el administrador
- Se crea el objeto `Whitelist` como Shared Object (tabla de promotores)

### Paso 1: Creación de propiedad
- Un promotor en whitelist llama a `create_property`
- Se crea un objeto `Property` (Owner Object) que queda a nombre del promotor
- La propiedad queda en estado "Disponible" (STATE_ENABLE)

### Paso 2: Reserva de la propiedad
- El comprador llama a `reserve_property` adjuntando el importe de reserva
- Los fondos se bloquean en el contrato y se transfieren al promotor
- Se crea un `ReservationTicket` como Owner Object para el comprador
- El estado de `Property` cambia a "En Reserva" (STATE_RESERVE)

### Paso 3: Finalización de la compra
- El comprador presenta su `ReservationTicket` en `finalize_reservation`
- El contrato verifica ticket y address del comprador
- Transfiere el `Property` al comprador
- El ticket se quema y la propiedad pasa a estado "Vendido" (STATE_SOLD)

### Flujo administrativo (Whitelist)
- Solo quien posee el `AdminCap` puede añadir promotores a la Whitelist
- La función `add_promoter` verifica que el caller tenga el AdminCap
- Los promotores en whitelist pueden crear propiedades sin intervención del admin

## Verificación de identidad (KYC simulado)

El proyecto está diseñado para usarse con **EUDI Wallet / OpenID4VP**, pero por tiempo de hackathon se implementa un flujo simulado:

### Implementación actual
- El modal usa el componente `KycStepWizard` y `PreReserveModal`
- El Step 0 actualmente:
  - Requiere una wallet conectada
  - Llama a un cliente `identityClient` que:
    - Inicia la sesión KYC (`/kyc/start`)
    - Asocia la sesión a la dirección Sui
    - Consulta el estado (`/kyc/status/:suiAddress`)
    - Cuando está verificado, marca `isVerified = true` y permite avanzar al Step 1

### Cómo conectar un proveedor real de OpenID4VP en el futuro
1. Reemplazar los endpoints simulados por llamadas reales a EUDI
2. Implementar el flujo de presentación verificable (Verifiable Presentation)
3. Mantener la misma interfaz de usuario (`KycStepWizard`)
4. Actualizar `identityClient.ts` para manejar respuestas reales del proveedor

## Instalación y ejecución local

### Requisitos
- Node.js 18.12+ 
- pnpm 8.0+ o npm
- Sui CLI configurado en testnet
- Git

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd hackathon-sui
```

### 2. Configurar variables de entorno

#### Frontend
Crear `.env` en la raíz del proyecto:
```env
NEXT_PUBLIC_WALLET_DAPP=0xab6514990a74081418d158963fd46b12e32240bc14048a0e88b0f67ef3287496
NEXT_PUBLIC_PACKAGE_ID=0xYOUR_PACKAGE_ID
NEXT_PUBLIC_MODULE=reserve
NEXT_PUBLIC_CLOCK_ID=0x6
NEXT_PUBLIC_ADMIN_CAP=0xYOUR_ADMIN_CAP_ID
NEXT_PUBLIC_WHITELIST_ID=0xYOUR_WHITELIST_ID
NEXT_PUBLIC_IDENTITY_API_URL=http://localhost:4000
NEXT_PUBLIC_BASE_IMAGE_URL=https://example.com/images
```

#### Backend de identidad
Crear `.env` en `backend-identity/`:
```env
SUI_NETWORK=testnet
EUID_PACKAGE_ID=0xe41bc54277a2854fe9b4cdc6e14ad4c464f653a4cb9ef18d74fe71f9aeaaeda3
AUTHORITY_ADDRESS=0xab6514990a74081418d158963fd46b12e32240bc14048a0e88b0f67ef3287496
PORT=4000
BACKEND_PORT=4000
SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
BACKEND_MNEMONIC="diet digital inner risk small reward awful legal brush expand main stairs"
BACKEND_PRIVATE_KEY=
```

### 3. Instalar dependencias
```bash
# Frontend
pnpm install

# Backend de identidad (si existe)
cd backend-identity
pnpm install
cd ..
```

### 4. Ejecutar los servicios
```bash
# Terminal 1: Backend de identidad
cd backend-identity
pnpm dev

# Terminal 2: Frontend
pnpm dev
```

### 5. Acceder a la aplicación
- Frontend: `http://localhost:3000`
- Backend de identidad: `http://localhost:4000`

## Despliegue del contrato Move

### 1. Configurar Sui CLI
```bash
# Añadir testnet environment
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Switch to testnet
sui client switch --env testnet
```

### 2. Obtener tokens de prueba
Visita [https://faucet.sui.io](https://faucet.sui.io) para obtener SUI de prueba.

### 3. Desplegar el contrato
```bash
cd move/reserve
sui client publish --gas-budget 100000000 .
```

### 4. Actualizar variables de entorno
Copia el `packageId` del resultado del despliegue y actualiza `NEXT_PUBLIC_PACKAGE_ID` en el `.env` del frontend.

## Limitaciones actuales y trabajo futuro

- **Integrar un proveedor real EUDI/OpenID4VP** en producción
- **Añadir manejo de errores más robusto** en el flujo KYC
- **Extender el modelo de propiedades** (más campos, filtros, etc.)
- **Integrar Walrus/Seal** para almacenar documentos de propiedad off-chain
- **Añadir pruebas automatizadas** adicionales para el flujo completo
- **Implementar sistema de notificaciones** para cambios de estado
- **Mejorar la experiencia móvil** con diseño responsive
- **Añadir soporte para múltiples monedas** en las transacciones

## Equipo

Proyecto desarrollado para la **Sui Move Hackathon 2025** por el equipo Instant Reserve.

## Licencia

MIT License - ver archivo LICENSE para detalles.
