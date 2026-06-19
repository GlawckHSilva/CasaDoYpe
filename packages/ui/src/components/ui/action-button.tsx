import { Eye, Pencil, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "./button";
import { cn } from "../../lib/utils";

/**
 * Botao padronizado para acoes recorrentes do produto.
 *
 * A escolha centralizada de icone, texto e variante evita que cada modulo
 * crie botoes visualmente diferentes para a mesma acao.
 */

export type ActionButtonAcao =
  | "visualizar"
  | "editar"
  | "excluir"
  | "adicionar"
  | "cancelar";

export type ActionButtonTom = "ciano" | "verde" | "azul" | "vermelho" | "vermelho-suave";

export type ActionButtonProps = Omit<ButtonProps, "children" | "variant"> & {
  acao: ActionButtonAcao;
  children?: ReactNode;
  mostrarIcone?: boolean;
  mostrarTexto?: boolean;
  tom?: ActionButtonTom;
  variant?: ButtonProps["variant"];
};

const acaoConfig = {
  visualizar: {
    label: "Visualizar",
    icon: Eye,
    variant: "outline",
    tom: "azul"
  },
  editar: {
    label: "Editar",
    icon: Pencil,
    variant: "default",
    tom: "ciano"
  },
  excluir: {
    label: "Excluir",
    icon: Trash2,
    variant: "destructive",
    tom: "vermelho"
  },
  adicionar: {
    label: "Adicionar",
    icon: Plus,
    variant: "secondary",
    tom: "verde"
  },
  cancelar: {
    label: "Cancelar",
    icon: X,
    variant: "outline",
    tom: "vermelho-suave"
  }
} satisfies Record<
  ActionButtonAcao,
  {
    label: string;
    icon: LucideIcon;
    tom: ActionButtonTom;
    variant: NonNullable<ButtonProps["variant"]>;
  }
>;

const tomClasses = {
  azul: "border-info/35 text-info hover:text-white [&_.action-button-fill]:bg-info",
  ciano: "border-primary/35 text-primary hover:text-primary-foreground [&_.action-button-fill]:bg-primary",
  verde: "border-success/35 text-success hover:text-white [&_.action-button-fill]:bg-success",
  vermelho:
    "border-destructive/35 text-destructive hover:text-white [&_.action-button-fill]:bg-destructive",
  "vermelho-suave":
    "border-destructive/25 bg-destructive/10 text-destructive hover:text-white [&_.action-button-fill]:bg-destructive"
} satisfies Record<ActionButtonTom, string>;

export function ActionButton({
  acao,
  children,
  className,
  mostrarIcone = true,
  mostrarTexto = true,
  tom,
  variant,
  type = "button",
  ...props
}: ActionButtonProps) {
  const config = acaoConfig[acao];
  const Icon = config.icon;
  const tomVisual = tom ?? config.tom;

  return (
    <Button
      className={cn(
        "group relative isolate overflow-hidden border transition-colors duration-300 [&_svg]:relative [&_svg]:z-10",
        tomClasses[tomVisual],
        className
      )}
      type={type}
      variant={variant ?? config.variant}
      {...props}
    >
      {/* O preenchimento progressivo padroniza feedback visual em cards e modais. */}
      <span
        aria-hidden="true"
        className="action-button-fill absolute inset-y-0 left-0 z-0 w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
      {mostrarIcone ? <Icon aria-hidden="true" /> : null}
      {mostrarTexto ? <span className="relative z-10">{children ?? config.label}</span> : null}
    </Button>
  );
}
