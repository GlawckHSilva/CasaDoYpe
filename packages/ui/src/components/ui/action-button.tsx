import { Eye, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "./button";

/**
 * Botao padronizado para acoes recorrentes do produto.
 *
 * A escolha centralizada de icone, texto e variante evita que cada modulo
 * crie botoes visualmente diferentes para a mesma acao.
 */

export type ActionButtonAcao = "visualizar" | "editar" | "excluir" | "adicionar";

export type ActionButtonProps = Omit<ButtonProps, "children" | "variant"> & {
  acao: ActionButtonAcao;
  children?: ReactNode;
  variant?: ButtonProps["variant"];
};

const acaoConfig = {
  visualizar: {
    label: "Visualizar",
    icon: Eye,
    variant: "outline"
  },
  editar: {
    label: "Editar",
    icon: Pencil,
    variant: "default"
  },
  excluir: {
    label: "Excluir",
    icon: Trash2,
    variant: "destructive"
  },
  adicionar: {
    label: "Adicionar",
    icon: Plus,
    variant: "secondary"
  }
} satisfies Record<
  ActionButtonAcao,
  {
    label: string;
    icon: LucideIcon;
    variant: NonNullable<ButtonProps["variant"]>;
  }
>;

export function ActionButton({
  acao,
  children,
  variant,
  type = "button",
  ...props
}: ActionButtonProps) {
  const config = acaoConfig[acao];
  const Icon = config.icon;

  return (
    <Button type={type} variant={variant ?? config.variant} {...props}>
      <Icon aria-hidden="true" />
      {children ?? config.label}
    </Button>
  );
}
