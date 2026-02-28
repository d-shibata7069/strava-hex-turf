import type { ReactNode } from "react";

/**
 * Storybook 用の next/link モック。Next の webpack を読まずにプレビューするため。
 */
export default function LinkMock({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}
