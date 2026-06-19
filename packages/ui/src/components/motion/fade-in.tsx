"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "../../lib/utils";

export type FadeInProps = HTMLMotionProps<"div">;

export function FadeIn({ className, ...props }: FadeInProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      viewport={{ once: true, margin: "-40px" }}
      whileInView={{ opacity: 1, y: 0 }}
      {...props}
    />
  );
}
