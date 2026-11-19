// Potvrdni okvir s tekstom (Kupnja-1280: „Prihvaćam uvjete korištenja …”).
// Tekst dolazi kao children (smije sadržavati linkove).
import type { ChangeEvent, ReactNode } from "react";
import css from "./polje.module.css";

export interface PotvrdniOkvirProps {
  id: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

export default function PotvrdniOkvir({ id, children, ...unos }: PotvrdniOkvirProps) {
  return (
    <label htmlFor={id} className={css.kvacica}>
      <input id={id} type="checkbox" {...unos} />
      <span>{children}</span>
    </label>
  );
}
