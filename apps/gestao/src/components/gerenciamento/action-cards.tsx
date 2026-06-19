"use client";

import { Home, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ActionButton,
  AppModal,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@hospedex/ui";

import { ModalCasa, type CasaGerenciamento } from "./modal-casa";

/**
 * Cards operacionais do modulo de gerenciamento.
 *
 * A responsabilidade deste componente e apenas expor acoes visiveis e modais
 * reais. Nenhuma regra de negocio, banco ou persistencia e alterada aqui.
 */

type TipoModal = "visualizar" | "editar";

type LocalGerenciamento = {
  id: string;
  tipo: "local";
  nome: string;
  descricao: string;
  status: string;
  destaque: string;
};

type EntidadeGerenciamento = LocalGerenciamento | (CasaGerenciamento & { tipo: "casa" });

type ModalAtiva = {
  entidade: EntidadeGerenciamento;
  tipo: TipoModal;
} | null;

type ModalCasaAtiva = {
  casa?: CasaGerenciamento;
  modo: "criar" | "editar";
} | null;

const casas: Array<CasaGerenciamento & { tipo: "casa" }> = [
  {
    id: "casa-principal",
    tipo: "casa",
    nome: "Casa Principal",
    descricao: "Unidade preparada para hospedagem completa.",
    status: "Ativa",
    destaque: "3 quartos"
  },
  {
    id: "casa-anexo",
    tipo: "casa",
    nome: "Casa Anexo",
    descricao: "Espaco auxiliar para estadias independentes.",
    status: "Revisao",
    destaque: "1 suite"
  }
];

const locais: EntidadeGerenciamento[] = [
  {
    id: "praia-central",
    tipo: "local",
    nome: "Praia Central",
    descricao: "Ponto turistico recomendado no guia do hospede.",
    status: "Publicado",
    destaque: "Natureza"
  },
  {
    id: "restaurante-local",
    tipo: "local",
    nome: "Restaurante Local",
    descricao: "Sugestao gastronomica proxima da hospedagem.",
    status: "Rascunho",
    destaque: "Gastronomia"
  }
];

export function ManagementActionCards() {
  const [modalAtiva, setModalAtiva] = useState<ModalAtiva>(null);
  const [modalCasaAtiva, setModalCasaAtiva] = useState<ModalCasaAtiva>(null);
  const entidade = modalAtiva?.entidade;
  const estaEditando = modalAtiva?.tipo === "editar";

  const descricaoModal = useMemo(() => {
    if (!entidade) return "";
    return estaEditando
      ? "Acoes administrativas ficam concentradas aqui para evitar formulario inline no card."
      : "Visualizacao rapida dos dados principais sem alterar regras de negocio.";
  }, [entidade, estaEditando]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <ActionSection
          entidades={casas}
          onAdicionar={() => setModalCasaAtiva({ modo: "criar" })}
          onEditar={(item) => {
            if (item.tipo === "casa") {
              setModalCasaAtiva({ casa: item, modo: "editar" });
            }
          }}
          onVisualizar={(item) => setModalAtiva({ entidade: item, tipo: "visualizar" })}
          titulo="Casas"
        />
        <ActionSection
          entidades={locais}
          onEditar={(item) => setModalAtiva({ entidade: item, tipo: "editar" })}
          onVisualizar={(item) => setModalAtiva({ entidade: item, tipo: "visualizar" })}
          titulo="Guia da Região"
        />
      </div>

      {entidade ? (
        <AppModal
          aberta={Boolean(modalAtiva)}
          aoFechar={() => setModalAtiva(null)}
          descricao={descricaoModal}
          titulo={`${estaEditando ? "Editar" : "Visualizar"} ${entidade.nome}`}
        >
          <ModalConteudo entidade={entidade} estaEditando={estaEditando} />
        </AppModal>
      ) : null}

      <ModalCasa
        aberta={Boolean(modalCasaAtiva)}
        aoFechar={() => setModalCasaAtiva(null)}
        casa={modalCasaAtiva?.casa}
        modo={modalCasaAtiva?.modo ?? "criar"}
      />
    </section>
  );
}

function ActionSection({
  titulo,
  entidades,
  onVisualizar,
  onEditar,
  onAdicionar
}: {
  titulo: string;
  entidades: EntidadeGerenciamento[];
  onVisualizar: (entidade: EntidadeGerenciamento) => void;
  onEditar: (entidade: EntidadeGerenciamento) => void;
  onAdicionar?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">{titulo}</h2>
        <ActionButton acao="adicionar" onClick={onAdicionar} size="sm">
          Adicionar
        </ActionButton>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {entidades.map((entidade) => (
          <ActionCard
            entidade={entidade}
            key={entidade.id}
            onEditar={onEditar}
            onVisualizar={onVisualizar}
          />
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  entidade,
  onVisualizar,
  onEditar
}: {
  entidade: EntidadeGerenciamento;
  onVisualizar: (entidade: EntidadeGerenciamento) => void;
  onEditar: (entidade: EntidadeGerenciamento) => void;
}) {
  const Icone = entidade.tipo === "casa" ? Home : MapPin;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
            <Icone aria-hidden="true" className="h-5 w-5" />
          </span>
          <Badge variant={entidade.status === "Ativa" || entidade.status === "Publicado" ? "success" : "secondary"}>
            {entidade.status}
          </Badge>
        </div>
        <CardTitle>{entidade.nome}</CardTitle>
        <CardDescription>{entidade.descricao}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="rounded-md border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground">
          {entidade.destaque}
        </p>
      </CardContent>
      <CardFooter className="grid grid-cols-2">
        <ActionButton acao="visualizar" className="w-full" onClick={() => onVisualizar(entidade)} />
        <ActionButton acao="editar" className="w-full" onClick={() => onEditar(entidade)} />
      </CardFooter>
    </Card>
  );
}

function ModalConteudo({
  entidade,
  estaEditando
}: {
  entidade: EntidadeGerenciamento;
  estaEditando: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoItem label="Tipo" value={entidade.tipo === "casa" ? "Casa" : "Local"} />
        <InfoItem label="Status" value={entidade.status} />
        <InfoItem label="Destaque" value={entidade.destaque} />
      </div>

      <p className="text-sm leading-6 text-muted-foreground">{entidade.descricao}</p>

      {estaEditando ? <AcoesEdicao entidade={entidade} /> : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AcoesEdicao({ entidade }: { entidade: EntidadeGerenciamento }) {
  if (entidade.tipo === "casa") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Acoes secundarias</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <ActionButton acao="excluir">Excluir casa</ActionButton>
          <ActionButton acao="editar">Comodidades</ActionButton>
          <ActionButton acao="editar">Politicas</ActionButton>
          <ActionButton acao="editar">Imagens</ActionButton>
          <ActionButton acao="editar">Configuracoes</ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Acoes secundarias</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <ActionButton acao="excluir">Excluir local</ActionButton>
        <ActionButton acao="editar">Ativar/desativar</ActionButton>
        <ActionButton acao="editar">Alterar foto</ActionButton>
        <ActionButton acao="editar">Ajustar categoria</ActionButton>
      </div>
    </div>
  );
}
