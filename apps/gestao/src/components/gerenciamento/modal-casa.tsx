"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type FormEvent
} from "react";

import { ActionButton, AppModal, Badge, Input, Label, cn } from "@hospedex/ui";

/**
 * Modal de cadastro e edicao de casas do modulo Gerenciamento.
 *
 * Este arquivo concentra apenas a experiencia de formulario. Os dados ficam em
 * estado local porque esta etapa prepara a interface sem implementar persistencia,
 * gateway de pagamento ou novas regras de banco.
 */

export type CasaGerenciamento = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
  destaque: string;
};

type ModalCasaModo = "criar" | "editar";
type EtapaCasa =
  | "basico"
  | "localizacao"
  | "estrutura"
  | "valores"
  | "regras"
  | "imagens"
  | "comodidades";

type JurosParcela = {
  parcela: number;
  percentual: string;
};

type FotoGaleria = {
  id: string;
  arquivo?: File;
  previewUrl?: string;
  titulo: string;
  ordem: number;
  principal: boolean;
};

type ModalCasaProps = {
  aberta: boolean;
  casa?: CasaGerenciamento | undefined;
  modo: ModalCasaModo;
  aoFechar: () => void;
};

const etapas = [
  { id: "basico", label: "Basico" },
  { id: "localizacao", label: "Localizacao" },
  { id: "estrutura", label: "Estrutura" },
  { id: "valores", label: "Valores" },
  { id: "regras", label: "Regras" },
  { id: "imagens", label: "Imagens" },
  { id: "comodidades", label: "Comodidades" }
] satisfies Array<{ id: EtapaCasa; label: string }>;

const comodidadesPadrao = [
  "Wi-Fi",
  "Ar-condicionado",
  "TV",
  "Cozinha",
  "Geladeira",
  "Micro-ondas",
  "Maquina de lavar",
  "Estacionamento",
  "Piscina",
  "Churrasqueira",
  "Roupa de cama",
  "Toalhas",
  "Pet friendly"
];

export function ModalCasa({ aberta, casa, modo, aoFechar }: ModalCasaProps) {
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaCasa>("basico");
  const [aceitaCartao, setAceitaCartao] = useState(true);
  const [maximoParcelas, setMaximoParcelas] = useState(4);
  const [jurosParcelas, setJurosParcelas] = useState<JurosParcela[]>([
    { parcela: 1, percentual: "0" },
    { parcela: 2, percentual: "2" },
    { parcela: 3, percentual: "3.5" },
    { parcela: 4, percentual: "5" }
  ]);
  const [imagemCapa, setImagemCapa] = useState<FotoGaleria | null>(null);
  const [galeria, setGaleria] = useState<FotoGaleria[]>([]);
  const [comodidadesSelecionadas, setComodidadesSelecionadas] = useState<string[]>([
    "Wi-Fi",
    "Cozinha",
    "Roupa de cama"
  ]);
  const [comodidadesPersonalizadas, setComodidadesPersonalizadas] = useState<string[]>([]);
  const [novaComodidade, setNovaComodidade] = useState("");

  const estaEditando = modo === "editar";
  const tituloModal = estaEditando ? `Editar ${casa?.nome ?? "casa"}` : "Nova casa";
  const descricaoModal = estaEditando
    ? "Atualize as informacoes da casa sem alterar regras de negocio nesta etapa."
    : "Cadastre a estrutura base da casa. A persistencia sera conectada em etapa futura.";

  const jurosVisiveis = useMemo(
    () =>
      Array.from({ length: maximoParcelas }, (_, index) => {
        const parcela = index + 1;
        return jurosParcelas.find((item) => item.parcela === parcela) ?? { parcela, percentual: "0" };
      }),
    [jurosParcelas, maximoParcelas]
  );

  function aoSalvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    aoFechar();
  }

  function atualizarMaximoParcelas(valor: number) {
    setMaximoParcelas(valor);
    setJurosParcelas((jurosAtuais) =>
      Array.from({ length: valor }, (_, index) => {
        const parcela = index + 1;
        return jurosAtuais.find((item) => item.parcela === parcela) ?? { parcela, percentual: "0" };
      })
    );
  }

  function atualizarJuros(parcela: number, percentual: string) {
    setJurosParcelas((jurosAtuais) =>
      jurosAtuais.map((item) => (item.parcela === parcela ? { ...item, percentual } : item))
    );
  }

  function escolherCapa(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setImagemCapa({
      id: crypto.randomUUID(),
      arquivo,
      previewUrl: URL.createObjectURL(arquivo),
      titulo: arquivo.name,
      ordem: 1,
      principal: true
    });
  }

  function adicionarFotos(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? []);
    if (!arquivos.length) return;

    setGaleria((fotosAtuais) => [
      ...fotosAtuais,
      ...arquivos.map((arquivo, index) => ({
        id: crypto.randomUUID(),
        arquivo,
        previewUrl: URL.createObjectURL(arquivo),
        titulo: arquivo.name,
        ordem: fotosAtuais.length + index + 1,
        principal: fotosAtuais.length === 0 && index === 0
      }))
    ]);
  }

  function removerFoto(fotoId: string) {
    setGaleria((fotosAtuais) => fotosAtuais.filter((foto) => foto.id !== fotoId));
  }

  function atualizarFoto(fotoId: string, campo: "titulo" | "ordem", valor: string) {
    setGaleria((fotosAtuais) =>
      fotosAtuais.map((foto) =>
        foto.id === fotoId
          ? { ...foto, [campo]: campo === "ordem" ? Number(valor) || 1 : valor }
          : foto
      )
    );
  }

  function definirFotoPrincipal(fotoId: string) {
    setGaleria((fotosAtuais) =>
      fotosAtuais.map((foto) => ({ ...foto, principal: foto.id === fotoId }))
    );
  }

  function alternarComodidade(nome: string) {
    setComodidadesSelecionadas((selecionadas) =>
      selecionadas.includes(nome)
        ? selecionadas.filter((item) => item !== nome)
        : [...selecionadas, nome]
    );
  }

  function adicionarComodidade() {
    const nome = novaComodidade.trim();
    if (!nome || comodidadesPersonalizadas.includes(nome)) return;

    setComodidadesPersonalizadas((atuais) => [...atuais, nome]);
    setComodidadesSelecionadas((atuais) => [...atuais, nome]);
    setNovaComodidade("");
  }

  function removerComodidade(nome: string) {
    setComodidadesPersonalizadas((atuais) => atuais.filter((item) => item !== nome));
    setComodidadesSelecionadas((atuais) => atuais.filter((item) => item !== nome));
  }

  return (
    <AppModal
      aberta={aberta}
      aoFechar={aoFechar}
      className="max-w-5xl"
      descricao={descricaoModal}
      rodape={
        <div className="flex justify-end">
          <ActionButton acao="adicionar" tom="ciano" type="submit" form="formulario-casa">
            {estaEditando ? "Salvar casa" : "Criar casa"}
          </ActionButton>
        </div>
      }
      titulo={tituloModal}
    >
      <form className="space-y-6" id="formulario-casa" onSubmit={aoSalvar}>
        <nav aria-label="Etapas do cadastro de casa" className="flex gap-2 overflow-x-auto pb-1">
          {etapas.map((etapa) => (
            <ActionButton
              acao="editar"
              aria-current={etapaAtiva === etapa.id ? "step" : undefined}
              className={cn(
                "shrink-0",
                etapaAtiva === etapa.id ? "border-primary bg-primary/10" : "bg-transparent"
              )}
              key={etapa.id}
              mostrarIcone={false}
              onClick={() => setEtapaAtiva(etapa.id)}
              size="sm"
              tom="ciano"
              variant="outline"
            >
              {etapa.label}
            </ActionButton>
          ))}
        </nav>

        {etapaAtiva === "basico" ? (
          <SecaoBasico casa={casa} estaEditando={estaEditando} />
        ) : null}
        {etapaAtiva === "localizacao" ? <SecaoLocalizacao /> : null}
        {etapaAtiva === "estrutura" ? <SecaoEstrutura /> : null}
        {etapaAtiva === "valores" ? (
          <SecaoValores
            aceitaCartao={aceitaCartao}
            jurosParcelas={jurosVisiveis}
            maximoParcelas={maximoParcelas}
            setAceitaCartao={setAceitaCartao}
            setMaximoParcelas={atualizarMaximoParcelas}
            setJurosParcela={atualizarJuros}
          />
        ) : null}
        {etapaAtiva === "regras" ? <SecaoRegras /> : null}
        {etapaAtiva === "imagens" ? (
          <SecaoImagens
            adicionarFotos={adicionarFotos}
            atualizarFoto={atualizarFoto}
            escolherCapa={escolherCapa}
            fotoCapa={imagemCapa}
            fotos={galeria}
            removerFoto={removerFoto}
            setFotoPrincipal={definirFotoPrincipal}
          />
        ) : null}
        {etapaAtiva === "comodidades" ? (
          <SecaoComodidades
            adicionarComodidade={adicionarComodidade}
            comodidadesPersonalizadas={comodidadesPersonalizadas}
            comodidadesSelecionadas={comodidadesSelecionadas}
            novaComodidade={novaComodidade}
            removerComodidade={removerComodidade}
            setNovaComodidade={setNovaComodidade}
            toggleComodidade={alternarComodidade}
          />
        ) : null}

        {estaEditando ? (
          <div className="border-t pt-5">
            <ActionButton acao="excluir">Excluir casa</ActionButton>
          </div>
        ) : null}
      </form>
    </AppModal>
  );
}

function SecaoBasico({
  casa,
  estaEditando
}: {
  casa?: CasaGerenciamento | undefined;
  estaEditando: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CampoTexto defaultValue={casa?.nome} label="Nome da casa" placeholder="Casa Principal" />
      <CampoTexto defaultValue={casa?.status} label="Status" placeholder="Ativa" />
      <div className="md:col-span-2">
        <Label htmlFor="descricao-casa">Descricao</Label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue={casa?.descricao}
          id="descricao-casa"
          placeholder="Resumo objetivo da casa para uso interno."
        />
      </div>
      <p className="text-sm text-muted-foreground md:col-span-2">
        {estaEditando
          ? "A edicao respeita o tenant atual e sera conectada a permissoes quando a API persistente entrar."
          : "Se multiunidades estiver desativado, a estrutura futura deve manter a unidade interna Casa inteira."}
      </p>
    </div>
  );
}

function SecaoLocalizacao() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CampoTexto label="Cidade" placeholder="Ex.: Ilhabela" />
      <CampoTexto label="Bairro" placeholder="Ex.: Centro" />
      <div className="md:col-span-2">
        <CampoTexto
          label="Link do Google Maps"
          placeholder="https://maps.google.com/... ou link encurtado"
          type="url"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Campo opcional. A estrutura aceita URL completa, link encurtado e futuramente coordenadas.
        </p>
      </div>
    </div>
  );
}

function SecaoEstrutura() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <CampoTexto label="Quartos" placeholder="3" type="number" />
      <CampoTexto label="Banheiros" placeholder="2" type="number" />
      <CampoTexto label="Hospedes" placeholder="8" type="number" />
      <CampoTexto label="Unidade interna" placeholder="Casa inteira" />
      <CampoTexto label="Area util" placeholder="120 m2" />
      <CampoTexto label="Vagas" placeholder="2" type="number" />
    </div>
  );
}

function SecaoValores({
  aceitaCartao,
  jurosParcelas,
  maximoParcelas,
  setAceitaCartao,
  setMaximoParcelas,
  setJurosParcela
}: {
  aceitaCartao: boolean;
  jurosParcelas: JurosParcela[];
  maximoParcelas: number;
  setAceitaCartao: (valor: boolean) => void;
  setMaximoParcelas: (valor: number) => void;
  setJurosParcela: (parcela: number, percentual: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <CampoTexto label="Diaria base" placeholder="450,00" />
        <CampoTexto label="Taxa de limpeza" placeholder="180,00" />
        <CampoTexto label="Hospede extra" placeholder="80,00" />
      </div>

      <section className="rounded-lg border bg-secondary/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Cartao de credito</h3>
            <p className="text-sm text-muted-foreground">
              Configuracao preparada para pagamento futuro, sem integrar gateway agora.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={aceitaCartao}
              onChange={(event) => setAceitaCartao(event.target.checked)}
              type="checkbox"
            />
            Aceita cartao
          </label>
        </div>

        {aceitaCartao ? (
          <div className="mt-4 space-y-4">
            <div className="max-w-xs">
              <Label htmlFor="maximo-parcelas">Quantidade maxima de parcelas</Label>
              <select
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="maximo-parcelas"
                onChange={(event) => setMaximoParcelas(Number(event.target.value))}
                value={maximoParcelas}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((parcela) => (
                  <option key={parcela} value={parcela}>
                    {parcela}x
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {jurosParcelas.map((item) => (
                <CampoTexto
                  key={item.parcela}
                  label={`${item.parcela}x - juros %`}
                  onChange={(event) => setJurosParcela(item.parcela, event.target.value)}
                  placeholder="0"
                  type="number"
                  value={item.percentual}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SecaoRegras() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CampoTexto label="Check-in" placeholder="14:00" />
      <CampoTexto label="Check-out" placeholder="11:00" />
      <CampoTexto label="Politica de cancelamento" placeholder="Flexivel" />
      <CampoTexto label="Regras internas" placeholder="Sem festas, silencio apos 22h" />
    </div>
  );
}

function SecaoImagens({
  adicionarFotos,
  atualizarFoto,
  escolherCapa,
  fotoCapa,
  fotos,
  removerFoto,
  setFotoPrincipal
}: {
  adicionarFotos: (event: ChangeEvent<HTMLInputElement>) => void;
  atualizarFoto: (fotoId: string, campo: "titulo" | "ordem", valor: string) => void;
  escolherCapa: (event: ChangeEvent<HTMLInputElement>) => void;
  fotoCapa: FotoGaleria | null;
  fotos: FotoGaleria[];
  removerFoto: (fotoId: string) => void;
  setFotoPrincipal: (fotoId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <input accept="image/*" className="hidden" id="imagem-capa" onChange={escolherCapa} type="file" />
        <input
          accept="image/*"
          className="hidden"
          id="galeria-casa"
          multiple
          onChange={adicionarFotos}
          type="file"
        />
        <ActionButton acao="adicionar" onClick={() => document.getElementById("imagem-capa")?.click()}>
          Escolher arquivo
        </ActionButton>
        <ActionButton acao="adicionar" tom="ciano" onClick={() => document.getElementById("galeria-casa")?.click()}>
          Adicionar foto
        </ActionButton>
      </div>

      {fotoCapa ? (
        <div className="rounded-lg border bg-secondary/20 p-3">
          <p className="mb-2 text-sm font-semibold">Imagem de capa</p>
          <ImagemPreview foto={fotoCapa} />
        </div>
      ) : null}

      {fotos.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {fotos.map((foto) => (
            <div className="rounded-lg border bg-card p-3" key={foto.id}>
              <ImagemPreview foto={foto} />
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_80px]">
                <CampoTexto
                  label="Nome/titulo"
                  onChange={(event) => atualizarFoto(foto.id, "titulo", event.target.value)}
                  value={foto.titulo}
                />
                <CampoTexto
                  label="Ordem"
                  onChange={(event) => atualizarFoto(foto.id, "ordem", event.target.value)}
                  type="number"
                  value={String(foto.ordem)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {foto.principal ? (
                  <Badge variant="success">Principal</Badge>
                ) : (
                  <ActionButton acao="editar" onClick={() => setFotoPrincipal(foto.id)} size="sm">
                    Definir principal
                  </ActionButton>
                )}
                <ActionButton acao="excluir" onClick={() => removerFoto(foto.id)} size="sm">
                  Remover foto
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma foto adicionada. Use os botoes acima para escolher uma capa ou iniciar a galeria.
        </p>
      )}
    </div>
  );
}

function SecaoComodidades({
  adicionarComodidade,
  comodidadesPersonalizadas,
  comodidadesSelecionadas,
  novaComodidade,
  removerComodidade,
  setNovaComodidade,
  toggleComodidade
}: {
  adicionarComodidade: () => void;
  comodidadesPersonalizadas: string[];
  comodidadesSelecionadas: string[];
  novaComodidade: string;
  removerComodidade: (nome: string) => void;
  setNovaComodidade: (valor: string) => void;
  toggleComodidade: (nome: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...comodidadesPadrao, ...comodidadesPersonalizadas].map((comodidade) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border bg-secondary/20 px-3 py-2 text-sm"
            key={comodidade}
          >
            <label className="flex items-center gap-2">
              <input
                checked={comodidadesSelecionadas.includes(comodidade)}
                onChange={() => toggleComodidade(comodidade)}
                type="checkbox"
              />
              {comodidade}
            </label>
            {comodidadesPersonalizadas.includes(comodidade) ? (
              <ActionButton acao="excluir" onClick={() => removerComodidade(comodidade)} size="sm">
                Remover
              </ActionButton>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <CampoTexto
          label="Nome da nova comodidade"
          onChange={(event) => setNovaComodidade(event.target.value)}
          placeholder="Ex.: Vista para o mar"
          value={novaComodidade}
        />
        <div className="flex items-end">
          <ActionButton acao="adicionar" onClick={adicionarComodidade}>
            Adicionar comodidade
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function CampoTexto({
  label,
  ...props
}: {
  label: string;
} & ComponentProps<typeof Input>) {
  const id = props.id ?? `campo-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input className="mt-2" id={id} {...props} />
    </div>
  );
}

function ImagemPreview({ foto }: { foto: FotoGaleria }) {
  if (!foto.previewUrl) {
    return null;
  }

  return (
    <img
      alt={foto.titulo || "Foto da casa"}
      className="aspect-video w-full rounded-md border object-cover"
      src={foto.previewUrl}
    />
  );
}
