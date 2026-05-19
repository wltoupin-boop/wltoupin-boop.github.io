import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import type { Therapy } from '@/types/therapy';
import { DiseaseCategory, TherapyType, ClinicalPhase, FDAApprovalStatus } from '@/types/therapy';
import { cn } from '@/lib/utils';
import { X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

// ─── Color maps ─────────────────────────────────────────────────────────────
const DISEASE_COLORS: Record<DiseaseCategory, string> = {
  [DiseaseCategory.ONCOLOGY]: '#EF4444',
  [DiseaseCategory.HEMATOLOGY]: '#8B5CF6',
  [DiseaseCategory.NEUROLOGY]: '#3B82F6',
  [DiseaseCategory.METABOLIC]: '#F97316',
  [DiseaseCategory.IMMUNOLOGY]: '#14B8A6',
  [DiseaseCategory.OPHTHALMOLOGY]: '#EAB308',
  [DiseaseCategory.MUSCULOSKELETAL]: '#6366F1',
  [DiseaseCategory.CARDIOVASCULAR]: '#EC4899',
  [DiseaseCategory.PULMONARY]: '#06B6D4',
  [DiseaseCategory.RARE_DISEASE]: '#A855F7',
  [DiseaseCategory.OTHER]: '#9CA3AF',
};

// Ring radii by phase (inner = approved, outer = preclinical)
const PHASE_RING: Record<ClinicalPhase, number> = {
  [ClinicalPhase.APPROVED]: 0,
  [ClinicalPhase.PHASE_3]: 1,
  [ClinicalPhase.PHASE_2_3]: 2,
  [ClinicalPhase.PHASE_2]: 2,
  [ClinicalPhase.PHASE_1_2]: 3,
  [ClinicalPhase.PHASE_1]: 3,
  [ClinicalPhase.PRECLINICAL]: 4,
  [ClinicalPhase.DISCONTINUED]: 5,
};

const RING_RADII = [60, 130, 200, 270, 340, 390];

interface TherapyNode extends d3.SimulationNodeDatum {
  id: string;
  therapy: Therapy;
  ringIndex: number;
  targetR: number;
  r: number;
  color: string;
}

interface PipelineVisualizationProps {
  therapies: Therapy[];
  onTherapySelect?: (therapy: Therapy | null) => void;
  selectedTherapyId?: string | null;
  height?: number;
}

interface FilterState {
  diseaseCategories: DiseaseCategory[];
  therapyTypes: TherapyType[];
  phases: ClinicalPhase[];
}

export const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({
  therapies,
  onTherapySelect,
  selectedTherapyId,
  height = 600,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<TherapyNode, undefined> | null>(null);
  const navigate = useNavigate();

  const [tooltip, setTooltip] = useState<{
    x: number; y: number; therapy: Therapy;
  } | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    diseaseCategories: [],
    therapyTypes: [],
    phases: [],
  });

  const [width, setWidth] = useState(800);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const filteredTherapies = React.useMemo(() => {
    return therapies.filter((t) => {
      if (filters.diseaseCategories.length > 0 && !filters.diseaseCategories.includes(t.disease_category)) return false;
      if (filters.therapyTypes.length > 0 && !filters.therapyTypes.includes(t.therapy_type)) return false;
      if (filters.phases.length > 0 && !filters.phases.includes(t.clinical_phase)) return false;
      return true;
    });
  }, [therapies, filters]);

  const toggleFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K][number]
  ) => {
    setFilters((prev) => {
      const arr = prev[key] as FilterState[K][number][];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  }, []);

  // Build D3 visualization
  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();

    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(cx, cy) - 20;
    const ringScale = maxRadius / RING_RADII[RING_RADII.length - 1];

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    const g = svg.append('g');

    // Draw concentric rings
    const ringLabels: Record<number, string> = {
      0: 'Approved',
      1: 'Phase 3',
      2: 'Phase 2',
      3: 'Phase 1',
      4: 'Preclinical',
      5: 'Discontinued',
    };

    RING_RADII.forEach((r, i) => {
      const scaledR = r * ringScale;
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', scaledR)
        .attr('fill', 'none')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', i === 0 ? 2 : 1)
        .attr('stroke-dasharray', i === 0 ? 'none' : '4,4');

      if (i < RING_RADII.length - 1) {
        g.append('text')
          .attr('x', cx + scaledR + 4)
          .attr('y', cy)
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 10)
          .attr('fill', '#9CA3AF')
          .text(ringLabels[i] ?? '');
      }
    });

    // Build nodes
    const populationExtent = d3.extent(
      filteredTherapies,
      (t) => t.epidemiology?.us_prevalence ?? 1000
    ) as [number, number];
    const rScale = d3.scaleSqrt()
      .domain([populationExtent[0] ?? 1, populationExtent[1] ?? 100000])
      .range([6, 22])
      .clamp(true);

    const nodes: TherapyNode[] = filteredTherapies.map((t) => {
      const ringIndex = PHASE_RING[t.clinical_phase] ?? 4;
      const ringR = RING_RADII[ringIndex] * ringScale;
      const angle = Math.random() * 2 * Math.PI;
      return {
        id: t.id,
        therapy: t,
        ringIndex,
        targetR: ringR,
        r: rScale(t.epidemiology?.us_prevalence ?? 5000),
        color: DISEASE_COLORS[t.disease_category] ?? '#9CA3AF',
        x: cx + ringR * Math.cos(angle),
        y: cy + ringR * Math.sin(angle),
      };
    });

    // FDA border styles
    const borderStyle = (t: Therapy): string => {
      switch (t.fda_approval_status) {
        case FDAApprovalStatus.APPROVED: return 'none';
        case FDAApprovalStatus.ACCELERATED: return '4,2';
        case FDAApprovalStatus.PRIORITY_REVIEW:
        case FDAApprovalStatus.BREAKTHROUGH: return '2,2';
        default: return '6,3';
      }
    };

    // Force simulation
    const simulation = d3.forceSimulation<TherapyNode>(nodes)
      .force('radial', d3.forceRadial<TherapyNode>(
        (d) => d.targetR,
        cx,
        cy
      ).strength(0.6))
      .force('collide', d3.forceCollide<TherapyNode>((d) => d.r + 3).strength(0.8))
      .force('center', d3.forceCenter(cx, cy).strength(0.01))
      .alphaDecay(0.02)
      .on('tick', ticked);

    simulationRef.current = simulation;

    // Node groups
    const nodeGroup = g.selectAll<SVGGElement, TherapyNode>('g.node')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, TherapyNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseenter', (event: MouseEvent, d) => {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          therapy: d.therapy,
        });
        d3.select(event.currentTarget as SVGGElement)
          .select('circle.node-circle')
          .attr('stroke-width', 3)
          .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))');
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
      })
      .on('mouseleave', (event: MouseEvent) => {
        setTooltip(null);
        d3.select(event.currentTarget as SVGGElement)
          .select('circle.node-circle')
          .attr('stroke-width', 1.5)
          .attr('filter', null);
      })
      .on('click', (_event: MouseEvent, d) => {
        onTherapySelect?.(d.therapy);
      })
      .on('dblclick', (_event: MouseEvent, d) => {
        navigate(`/catalog/${d.id}`);
      });

    nodeGroup.append('circle')
      .attr('class', 'node-circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', (d) => (selectedTherapyId && d.id !== selectedTherapyId ? 0.4 : 0.85))
      .attr('stroke', (d) =>
        d.therapy.fda_approval_status === FDAApprovalStatus.APPROVED ? '#FFFFFF' : '#FFFFFF'
      )
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d) => borderStyle(d.therapy));

    // Label for larger nodes
    nodeGroup
      .filter((d) => d.r >= 14)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d) => Math.max(7, d.r * 0.4))
      .attr('fill', 'white')
      .attr('pointer-events', 'none')
      .attr('font-weight', '600')
      .text((d) => {
        const name = d.therapy.product_name;
        return name.length > 8 ? name.slice(0, 7) + '…' : name;
      });

    function ticked() {
      nodeGroup.attr('transform', (d) => `translate(${d.x ?? cx},${d.y ?? cy})`);
    }

    return () => {
      simulation.stop();
    };
  }, [filteredTherapies, width, height, selectedTherapyId, navigate, onTherapySelect]);

  const handleZoom = useCallback((factor: number) => {
    const svg = d3.select(svgRef.current!);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 3]);
    svg.transition().duration(300).call(zoom.scaleBy, factor);
  }, []);

  const handleReset = useCallback(() => {
    const svg = d3.select(svgRef.current!);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 3]);
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
  }, []);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-3" style={{ height }}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-1">
          {Object.entries(DISEASE_COLORS).map(([cat, color]) => (
            <button
              key={cat}
              onClick={() => toggleFilter('diseaseCategories', cat as DiseaseCategory)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all',
                filters.diseaseCategories.includes(cat as DiseaseCategory)
                  ? 'opacity-100 shadow-sm'
                  : 'opacity-60 hover:opacity-80'
              )}
              style={{
                borderColor: color,
                backgroundColor: filters.diseaseCategories.includes(cat as DiseaseCategory)
                  ? color + '33'
                  : 'white',
                color,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SVG */}
      <div className="relative flex-1 rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="touch-none"
        />

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <button
            onClick={() => handleZoom(1.3)}
            className="rounded-md border border-neutral-200 bg-white p-2 shadow-sm hover:bg-neutral-50"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4 text-neutral-600" />
          </button>
          <button
            onClick={() => handleZoom(0.77)}
            className="rounded-md border border-neutral-200 bg-white p-2 shadow-sm hover:bg-neutral-50"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4 text-neutral-600" />
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-neutral-200 bg-white p-2 shadow-sm hover:bg-neutral-50"
            aria-label="Reset view"
          >
            <RefreshCw className="h-4 w-4 text-neutral-600" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg border border-neutral-200 bg-white/90 backdrop-blur-sm p-3 text-xs">
          <p className="font-semibold text-neutral-700 mb-2">Legend</p>
          <div className="space-y-1 text-neutral-600">
            <div className="flex items-center gap-2">
              <svg width="20" height="12">
                <circle cx="6" cy="6" r="5" fill="#6B7280" stroke="white" strokeWidth="1.5" />
              </svg>
              <span>Node size = patient population</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="12">
                <circle cx="6" cy="6" r="5" fill="#6B7280" stroke="white" strokeWidth="1.5" />
              </svg>
              <span>Solid border = Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="12">
                <circle cx="6" cy="6" r="5" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4,2" />
              </svg>
              <span>Dashed = Accelerated</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="12">
                <circle cx="6" cy="6" r="5" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="2,2" />
              </svg>
              <span>Dotted = In review</span>
            </div>
          </div>
          <p className="mt-2 font-semibold text-neutral-700">Rings (center → outer)</p>
          <p className="text-neutral-500">Approved → Phase 3 → Phase 2 → Phase 1 → Preclinical</p>
        </div>

        {/* Active filter badge */}
        {(filters.diseaseCategories.length > 0 || filters.therapyTypes.length > 0 || filters.phases.length > 0) && (
          <button
            onClick={() => setFilters({ diseaseCategories: [], therapyTypes: [], phases: [] })}
            className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white shadow"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs rounded-lg border border-neutral-200 bg-white p-3 shadow-xl pointer-events-none"
          style={{ top: tooltip.y + 12, left: tooltip.x + 12 }}
        >
          <p className="font-semibold text-neutral-900">{tooltip.therapy.product_name}</p>
          <p className="text-xs text-neutral-500">{tooltip.therapy.manufacturer}</p>
          <div className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
            <p><span className="font-medium">Phase:</span> {tooltip.therapy.clinical_phase}</p>
            <p><span className="font-medium">Disease:</span> {tooltip.therapy.disease_category}</p>
            <p><span className="font-medium">Type:</span> {tooltip.therapy.therapy_type}</p>
            <p><span className="font-medium">Status:</span> {tooltip.therapy.fda_approval_status}</p>
            {tooltip.therapy.epidemiology?.us_prevalence && (
              <p>
                <span className="font-medium">US Prevalence:</span>{' '}
                {tooltip.therapy.epidemiology.us_prevalence.toLocaleString()}
              </p>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-neutral-400">Click to select · Double-click for details</p>
        </div>
      )}
    </div>
  );
};
