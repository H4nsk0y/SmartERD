import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  className?: string;
};

/** Универсальная кнопка тулбара с “sliced” визуалом. */
export default function SliceButton({ children, className = "", ...rest }: Props) {
  return (
    <button className={`btn-slice ${className}`} {...rest}>
      <div className="top"><span>{children}</span></div>
      <div className="bottom"><span>{children}</span></div>
    </button>
  );
}
