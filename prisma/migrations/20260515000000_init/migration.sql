-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('OFICIO_SAT', 'RESOLUCION_TFJA', 'ACUERDO_SUSPENSION', 'DEMANDA_NULIDAD', 'AMPARO', 'CONTESTACION', 'REQUERIMIENTO', 'NOTIFICACION', 'ACTO_ADMINISTRATIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "RolMensaje" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TipoSintesis" AS ENUM ('EJECUTIVA', 'PROFUNDA', 'ESTRATEGIA_DEFENSA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Caso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "expedienteNumero" TEXT,
    "rfcContribuyente" TEXT,
    "razonSocial" TEXT,
    "autoridadEmisora" TEXT,
    "montoTotal" DECIMAL(20,2),
    "estadoProcesal" TEXT,
    "plazoProximo" TIMESTAMP(3),
    "notas" TEXT,
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "textoExtraido" TEXT,
    "ocrAplicado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEmision" TIMESTAMP(3),
    "metadatos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "casoId" TEXT,
    "userId" TEXT NOT NULL,
    "rol" "RolMensaje" NOT NULL,
    "contenido" TEXT NOT NULL,
    "modelo" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sintesis" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "tipo" "TipoSintesis" NOT NULL,
    "contenidoMarkdown" TEXT NOT NULL,
    "datosEstructurados" JSONB,
    "modelo" TEXT NOT NULL,
    "generadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sintesis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Caso_userId_idx" ON "Caso"("userId");

-- CreateIndex
CREATE INDEX "Caso_rfcContribuyente_idx" ON "Caso"("rfcContribuyente");

-- CreateIndex
CREATE INDEX "Documento_casoId_idx" ON "Documento"("casoId");

-- CreateIndex
CREATE INDEX "Mensaje_casoId_idx" ON "Mensaje"("casoId");

-- CreateIndex
CREATE INDEX "Mensaje_userId_idx" ON "Mensaje"("userId");

-- CreateIndex
CREATE INDEX "Sintesis_casoId_idx" ON "Sintesis"("casoId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sintesis" ADD CONSTRAINT "Sintesis_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
