"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";
import { ActionButton } from "../ui/action-button";

/**
 * Modal base da aplicacao com Portal real.
 *
 * O Portal garante que o conteudo da modal nao fique preso ao card de origem.
 * Isso evita formularios inline e preserva o foco visual com fundo escuro e blur.
 */

export type AppModalProps = {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
};

export function AppModal({
  aberta,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  className
}: AppModalProps) {
  useEffect(() => {
    if (!aberta) return;

    const aoPressionarTecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") aoFechar();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoPressionarTecla);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  return createPortal(
    <div
      aria-labelledby="app-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md"
      role="dialog"
    >
      <button
        aria-label="Fechar modal"
        className="absolute inset-0 cursor-default"
        onClick={aoFechar}
        type="button"
      />
      <section
        className={cn(
          "relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl",
          className
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-normal" id="app-modal-title">
              {titulo}
            </h2>
            {descricao ? (
              <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
            ) : null}
          </div>
          <ActionButton
            acao="cancelar"
            aria-label="Fechar modal"
            mostrarTexto={false}
            onClick={aoFechar}
            size="icon"
            variant="ghost"
          />
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape ? <footer className="border-t px-5 py-4">{rodape}</footer> : null}
      </section>
    </div>,
    document.body
  );
}
