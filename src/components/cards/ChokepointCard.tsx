import { Stack, Text, Group, Paper, Badge, Divider } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import { Anchor, Clock, Users, Activity } from 'lucide-react';
import {
  useChokepointStore,
  type ChokepointId,
  chokepointStatus,
} from '@/store/chokepoints';

export function ChokepointCard({ id }: { id: ChokepointId }) {
  const feature = useChokepointStore((s) =>
    s.features.find((f) => f.id === id)
  );
  const metrics = useChokepointStore((s) => s.metrics[id]);
  const baseline = useChokepointStore((s) => s.baselines[id]);

  if (!feature) {
    return (
      <Paper p="md" withBorder>
        <Text size="xs" c="dimmed">
          Chokepoint data still loading…
        </Text>
      </Paper>
    );
  }

  // Rough per-hour rate from session-cumulative transits. Falls back to
  // 0 until the metrics engine has produced a sample.
  const sessionHours =
    metrics?.sampledAt && metrics.transits > 0
      ? Math.max((metrics.sampledAt - (metrics.sampledAt - metrics.history.length * 10_000)) / 3_600_000, 1 / 60)
      : 1;
  const transitsPerHour = metrics ? metrics.transits / sessionHours : 0;
  const status = chokepointStatus(
    transitsPerHour,
    baseline?.transitsPerDay ?? 0
  );
  const statusColor =
    status === 'critical'
      ? '#F43F5E'
      : status === 'elevated'
        ? '#F59E0B'
        : status === 'nominal'
          ? '#00E5A8'
          : '#64748B';

  const history = metrics?.history ?? [];
  // Sparkline wants at least 2 points; pad with zeros so the component
  // renders a flat line rather than erroring on cold start.
  const sparkData = history.length >= 2 ? history : [0, 0];

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <Anchor size={14} color={statusColor} />
          <Text size="xs" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            Chokepoint · {feature.region}
          </Text>
        </Group>
        <Text size="lg" fw={600} lh={1.15}>
          {feature.name}
        </Text>
        <Group gap={4}>
          <Badge
            size="xs"
            variant="outline"
            color={
              status === 'critical'
                ? 'red'
                : status === 'elevated'
                  ? 'yellow'
                  : status === 'nominal'
                    ? 'meridian'
                    : 'gray'
            }
          >
            {status.toUpperCase()}
          </Badge>
        </Group>
      </Stack>

      <Text size="xs" c="dimmed" lh={1.4}>
        {feature.description}
      </Text>

      <Divider color="var(--meridian-border)" />

      <Group grow gap="xs">
        <Metric
          icon={<Users size={12} />}
          label="Vessels inside"
          value={metrics ? String(metrics.vesselsInside) : '—'}
        />
        <Metric
          icon={<Activity size={12} />}
          label="Queue"
          value={metrics ? String(metrics.queueLength) : '—'}
          hint={
            baseline
              ? `baseline ${baseline.typicalQueue}`
              : undefined
          }
        />
      </Group>
      <Group grow gap="xs">
        <Metric
          icon={<Clock size={12} />}
          label="Avg dwell"
          value={
            metrics && metrics.avgDwellHours > 0
              ? `${metrics.avgDwellHours.toFixed(1)} h`
              : '—'
          }
          hint={
            baseline
              ? `baseline ${baseline.avgDwellHours} h`
              : undefined
          }
        />
        <Metric
          label="Transits (session)"
          value={metrics ? String(metrics.transits) : '—'}
          hint={
            baseline
              ? `baseline ${baseline.transitsPerDay}/day`
              : undefined
          }
        />
      </Group>

      <Paper p="sm" withBorder>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={600}>
            Live throughput
          </Text>
          <Text size="10px" c="dimmed" ff="monospace" data-mono>
            {history.length * 10}s
          </Text>
        </Group>
        <Sparkline
          h={48}
          data={sparkData}
          curveType="monotone"
          color={statusColor}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </Paper>

      {baseline?.notes && (
        <Text size="10px" c="dimmed" lh={1.4}>
          {baseline.notes}
        </Text>
      )}
    </Stack>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Paper p="xs" withBorder>
      <Group gap={4} mb={2}>
        {icon}
        <Text size="10px" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={500} ff="monospace" data-mono>
        {value}
      </Text>
      {hint && (
        <Text size="10px" c="dimmed" ff="monospace" data-mono>
          {hint}
        </Text>
      )}
    </Paper>
  );
}
