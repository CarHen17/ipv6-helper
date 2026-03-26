import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { CalculatorProvider } from "@/hooks/useCalculatorState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Planner from "./pages/Planner";
import EUI64 from "./pages/EUI64";
import Overlap from "./pages/Overlap";
import History from "./pages/History";
import DNS from "./pages/DNS";
import Network from "./pages/Network";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <HashRouter>
          <CalculatorProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/eui64" element={<EUI64 />} />
                <Route path="/overlap" element={<Overlap />} />
                <Route path="/history" element={<History />} />
                <Route path="/dns" element={<DNS />} />
                <Route path="/network" element={<Network />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </CalculatorProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
