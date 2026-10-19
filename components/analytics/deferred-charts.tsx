"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { useLocale } from "@/components/locale-provider";

const LazyCashflow = dynamic(() => import("./chart-implementations").then((m) => m.CashflowChart), { ssr: false });
const LazyExpenseTrend = dynamic(() => import("./chart-implementations").then((m) => m.ExpenseTrendChart), { ssr: false });
const LazySavingsRate = dynamic(() => import("./chart-implementations").then((m) => m.SavingsRateChart), { ssr: false });
const LazyCategoryTrend = dynamic(() => import("./chart-implementations").then((m) => m.CategoryTrendChart), { ssr: false });
const LazyAmountHistogram = dynamic(() => import("./chart-implementations").then((m) => m.AmountHistogramChart), { ssr: false });
const LazyYearOverYear = dynamic(() => import("./chart-implementations").then((m) => m.YearOverYearChart), { ssr: false });
const LazyWeekdayExpense = dynamic(() => import("./chart-implementations").then((m) => m.WeekdayExpenseChart), { ssr: false });
const LazyDivergingBar = dynamic(() => import("./chart-implementations").then((m) => m.DivergingBarChart), { ssr: false });
const LazyDonut = dynamic(() => import("./chart-implementations").then((m) => m.DonutChart), { ssr: false });

/** Reserve the exact chart height, including while its chunk downloads (issue 168). */
export function DeferredChart({ height, children }: { height: number; children: ReactNode }) {
  const { t } = useLocale();
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- progressive enhancement without IntersectionObserver
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} data-deferred-chart className="relative" style={{ minHeight: height }}>
      <div aria-hidden="true" className="absolute inset-0 rounded-lg bg-muted/30 motion-safe:animate-pulse" />
      <div className="relative bg-card">
        {visible ? children : <div role="status" style={{ height }}><span className="sr-only">{t("common.state.loading")}</span></div>}
      </div>
    </div>
  );
}

export function CashflowChart(props: ComponentProps<typeof LazyCashflow>) {
  return <DeferredChart height={props.data.length ? props.height ?? 280 : 192}><LazyCashflow {...props} /></DeferredChart>;
}
export function ExpenseTrendChart(props: ComponentProps<typeof LazyExpenseTrend>) {
  const previous = props.data.at(-2);
  const deltaHeight = previous && previous.expense !== 0 ? 28 : 0;
  return <DeferredChart height={props.data.length ? (props.height ?? 240) + deltaHeight : 192}><LazyExpenseTrend {...props} /></DeferredChart>;
}
export function SavingsRateChart(props: ComponentProps<typeof LazySavingsRate>) {
  return <DeferredChart height={props.data.length ? props.height ?? 220 : 192}><LazySavingsRate {...props} /></DeferredChart>;
}
export function CategoryTrendChart(props: ComponentProps<typeof LazyCategoryTrend>) {
  return <DeferredChart height={props.data.points.length && props.data.series.length ? props.height ?? 280 : 192}><LazyCategoryTrend {...props} /></DeferredChart>;
}
export function AmountHistogramChart(props: ComponentProps<typeof LazyAmountHistogram>) {
  return <DeferredChart height={props.data.some((row) => row.count !== 0) ? props.height ?? 240 : 192}><LazyAmountHistogram {...props} /></DeferredChart>;
}
export function YearOverYearChart(props: ComponentProps<typeof LazyYearOverYear>) {
  return <DeferredChart height={props.data.length ? props.height ?? 280 : 192}><LazyYearOverYear {...props} /></DeferredChart>;
}
export function WeekdayExpenseChart(props: ComponentProps<typeof LazyWeekdayExpense>) {
  return <DeferredChart height={props.data.some((row) => row.totalCents !== 0) ? props.height ?? 240 : 192}><LazyWeekdayExpense {...props} /></DeferredChart>;
}
export function DivergingBarChart(props: ComponentProps<typeof LazyDivergingBar>) {
  return <DeferredChart height={props.data.length ? props.height ?? 280 : 192}><LazyDivergingBar {...props} /></DeferredChart>;
}
export function DonutChart(props: ComponentProps<typeof LazyDonut>) {
  return <DeferredChart height={props.data.length ? props.height ?? 280 : 192}><LazyDonut {...props} /></DeferredChart>;
}
