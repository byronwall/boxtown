import { A, createAsync } from "@solidjs/router";
import { Download, Eye, ShieldAlert } from "lucide-solid";
import { For, Show } from "solid-js";
import { Box, HStack, Stack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { getProjectBackupFiles } from "~/lib/projects/data";
import type { ProjectBackupFileSummary } from "~/lib/projects/data.server";
import { PageMeta } from "~/lib/seo";

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

export default function AdminRoute() {
  const backups = createAsync(() => getProjectBackupFiles());

  return (
    <>
      <PageMeta
        title="Admin - Boxtown"
        description="Administrative tools for Boxtown."
      />
      <Box
        minH="100dvh"
        w="100%"
        boxSizing="border-box"
        p={{ base: "10px", md: "24px" }}
        color="#171c19"
        fontFamily={monoFont}
        bg="linear-gradient(180deg, rgba(248,250,248,0.98), rgba(225,229,224,1))"
      >
        <Stack
          maxW="1180px"
          mx="auto"
          gap="12px"
          border="1px solid rgba(96, 101, 95, 0.58)"
          borderRadius="8px"
          bg="rgba(252, 253, 252, 0.95)"
          boxShadow="0 24px 64px rgba(29, 33, 28, 0.14)"
          p={{ base: "10px", md: "14px" }}
        >
          <HStack
            justifyContent="space-between"
            alignItems="center"
            gap="3"
            flexWrap="wrap"
            borderBottom="1px solid rgba(95, 101, 94, 0.28)"
            pb="12px"
          >
            <HStack gap="2" minW="0">
              <Box as={ShieldAlert} boxSize="18px" color="#173e27" />
              <Heading as="h1" fontSize={{ base: "18px", md: "20px" }} lineHeight="1.1">
                Admin
              </Heading>
            </HStack>
            <Button as={A} href="/" variant="outline" size="sm">
              Projects
            </Button>
          </HStack>

          <Stack gap="8px">
            <HStack justifyContent="space-between" alignItems="center" gap="3" flexWrap="wrap">
              <Heading as="h2" fontSize="14px" lineHeight="1.2">
                Project backup files
              </Heading>
              <Text fontSize="12px" color="#475249" fontWeight="700">
                {backups.latest?.length ?? 0} found
              </Text>
            </HStack>

            <Show
              when={(backups.latest ?? []).length > 0}
              fallback={
                <Box
                  p="20px"
                  border="1px dashed rgba(95, 101, 94, 0.4)"
                  borderRadius="6px"
                  bg="rgba(244, 247, 243, 0.78)"
                >
                  <Text fontSize="13px" color="#323b35">
                    No recovered project backup files found.
                  </Text>
                </Box>
              }
            >
              <VStack alignItems="stretch" gap="2">
                <For each={backups.latest ?? []}>
                  {(backup) => <BackupRow backup={backup} />}
                </For>
              </VStack>
            </Show>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}

function BackupRow(props: { backup: ProjectBackupFileSummary }) {
  const href = () =>
    `/api/admin/project-backups/${encodeURIComponent(props.backup.projectId)}/${encodeURIComponent(
      props.backup.filename,
    )}`;

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "1.1fr 1.8fr auto auto" }}
      gap={{ base: "8px", lg: "12px" }}
      alignItems="center"
      border="1px solid rgba(95, 101, 94, 0.3)"
      borderRadius="6px"
      bg="rgba(244, 247, 243, 0.82)"
      p="10px"
    >
      <Stack gap="2px" minW="0">
        <Text fontSize="11px" color="#475249" fontWeight="700">
          Project
        </Text>
        <Text fontSize="13px" fontWeight="700" wordBreak="break-word">
          {props.backup.projectId}
        </Text>
      </Stack>
      <Stack gap="2px" minW="0">
        <Text fontSize="11px" color="#475249" fontWeight="700">
          File
        </Text>
        <Text fontSize="13px" wordBreak="break-word">
          {props.backup.filename}
        </Text>
      </Stack>
      <Stack gap="2px" minW="0">
        <Text fontSize="11px" color="#475249" fontWeight="700">
          Modified
        </Text>
        <Text fontSize="12px" fontVariantNumeric="tabular-nums">
          {formatDate(props.backup.updatedAt)}
        </Text>
      </Stack>
      <HStack gap="3" justifyContent={{ base: "space-between", lg: "flex-end" }}>
        <Text fontSize="12px" color="#475249" fontWeight="700" whiteSpace="nowrap">
          {formatBytes(props.backup.size)}
        </Text>
        <Button as="a" href={href()} size="sm" variant="outline">
          <Box as={Eye} boxSize="14px" />
          View
        </Button>
        <Button as="a" href={`${href()}?download=1`} size="sm" variant="solid">
          <Box as={Download} boxSize="14px" />
          Download
        </Button>
      </HStack>
    </Box>
  );
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const kib = size / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
