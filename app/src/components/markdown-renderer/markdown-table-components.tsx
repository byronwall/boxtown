import type { SolidMarkdownComponents } from "solid-markdown";
import { css } from "styled-system/css";

const styles = {
  tableWrapper: css({
    width: "full",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    my: 6,
    borderWidth: "1px",
    borderColor: "border.subtle",
    borderRadius: "md",
    boxShadow: "0 1px 2px token(colors.black.a2)",
  }),
  table: css({
    width: "max-content",
    minWidth: "full",
    borderCollapse: "collapse",
    overflow: "hidden",
    "& thead:has(th:empty)": {
      display: "none",
    },
  }),
};

export const markdownTableComponents = {
  table: (tableProps) => (
    <div class={styles.tableWrapper}>
      <table class={styles.table} {...tableProps} />
    </div>
  ),
  hr: (hrProps) => (
    <hr
      class={css({
        borderColor: "border.subtle",
        my: 4,
      })}
      {...hrProps}
    />
  ),
  thead: (theadProps) => (
    <thead
      class={css({
        bg: "bg.subtle",
        borderBottomWidth: "1px",
        borderBottomColor: "border.subtle",
      })}
      {...theadProps}
    />
  ),
  tbody: (tbodyProps) => <tbody {...tbodyProps} />,
  tr: (trProps) => (
    <tr
      class={css({
        borderBottomWidth: "1px",
        borderBottomColor: "border.subtle",
        _even: {
          bg: "bg.muted",
        },
      })}
      {...trProps}
    />
  ),
  th: (thProps) => {
    // TODO:AS_ANY - solid-markdown passes props with incompatible ref types
    const { _isHeader, ...restProps } = thProps as any;
    return (
      <th
        class={css({
          px: 3,
          py: 2,
          textAlign: "left",
          fontWeight: "semibold",
          fontSize: "sm",
        })}
        {...restProps}
      />
    );
  },
  td: (tdProps) => {
    // TODO:AS_ANY - solid-markdown passes props with incompatible ref types
    const { _isHeader, ...restProps } = tdProps as any;
    return (
      <td
        class={css({
          px: 3,
          py: 2,
          fontSize: "sm",
        })}
        {...restProps}
      />
    );
  },
} satisfies SolidMarkdownComponents;
