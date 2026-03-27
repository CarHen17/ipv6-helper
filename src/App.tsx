import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { CalculatorProvider } from "@/hooks/useCalculatorState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const Planner   = lazy(() => import("./pages/Planner"));
const EUI64     = lazy(() => import("./pages/EUI64"));
const Overlap   = lazy(() => import("./pages/Overlap"));
const History   = lazy(() => import("./pages/History"));
const DNS       = lazy(() => import("./pages/DNS"));
const Network   = lazy(() => import("./pages/Network"));
const Readiness = lazy(() => import("./pages/Readiness"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <HashRouter>
          <CalculatorProvider>
            <AppLayout>
              <Suspense>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/planner" element={<Planner />} />
                  <Route path="/eui64" element={<EUI64 />} />
                  <Route path="/overlap" element={<Overlap />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/dns" element={<DNS />} />
                  <Route path="/network" element={<Network />} />
                  <Route path="/readiness" element={<Readiness />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </CalculatorProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
