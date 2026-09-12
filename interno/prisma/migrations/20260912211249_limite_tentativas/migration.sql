-- CreateTable
CREATE TABLE "limite_tentativa" (
    "chave" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "contagem" INTEGER NOT NULL,
    "atualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limite_tentativa_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "limite_tentativa_inicio_idx" ON "limite_tentativa"("inicio");
