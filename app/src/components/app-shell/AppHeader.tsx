import { A } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

// Router A is not a Panda styled component, so link styling is passed as a class.
const homeLinkClass = css({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: "0",
  borderRadius: "4px",
  _focusVisible: { outline: "2px solid var(--spatial-map-accent)", outlineOffset: "2px" },
});

const logoClass = css({
  display: "block",
  w: "20px",
  h: "20px",
});

const parentLinkClass = css({
  flexShrink: "0",
  color: "var(--spatial-map-copy-dim)",
  fontSize: "13px",
  lineHeight: "1.25",
  textDecoration: "none",
  borderRadius: "2px",
  _hover: { color: "var(--spatial-map-copy)", textDecoration: "underline", textUnderlineOffset: "3px" },
  _focusVisible: { outline: "2px solid var(--spatial-map-accent)", outlineOffset: "2px" },
});

// The one top bar every page uses: logo home link, an optional parent crumb,
// the page's own title content, and page actions on the right.
export function AppHeader(props: {
  homeHref?: string;
  parent?: { href: string; label: string };
  children: JSX.Element;
  actions?: JSX.Element;
}) {
  return (
    <Box
      as="header"
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) auto" }}
      alignItems="center"
      gap="8px"
      minH="44px"
      p="6px 12px"
      borderBottom="1px solid var(--spatial-map-panel-border)"
      background="var(--spatial-map-panel-strong)"
    >
      <HStack gap="2" alignItems="center" minW="0">
        <A href={props.homeHref ?? "/"} class={homeLinkClass} aria-label="All projects">
          {/* A plain img so width/height stay HTML attributes: the SVG has no
              intrinsic size and would fill the page before the stylesheet applies. */}
          <img
            src={`${import.meta.env.SERVER_BASE_URL || ""}/logo.svg`}
            alt=""
            width="20"
            height="20"
            class={logoClass}
          />
        </A>
        <Show when={props.parent}>
          {(parent) => (
            <>
              <A href={parent().href} class={parentLinkClass}>
                {parent().label}
              </A>
              <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="13px" aria-hidden="true">
                /
              </Text>
            </>
          )}
        </Show>
        {props.children}
      </HStack>
      <HStack
        gap="2"
        flexWrap="wrap"
        justifyContent={{ base: "flex-start", lg: "flex-end" }}
        alignItems="center"
        minW="0"
      >
        {props.actions}
      </HStack>
    </Box>
  );
}

// Shown while a route's data is loading: the same header bar and page field,
// with a placeholder where the title will be.
export function AppShellFallback() {
  return (
    <Box
      display="grid"
      gridTemplateRows="auto minmax(0, 1fr)"
      minH="100dvh"
      background="var(--spatial-map-bg)"
      aria-busy="true"
      aria-label="Loading"
    >
      <AppHeader>
        <Box w="160px" maxW="40vw" h="12px" borderRadius="3px" background="color-mix(in srgb, var(--spatial-map-ink) 18%, transparent)" />
      </AppHeader>
      <Box />
    </Box>
  );
}
