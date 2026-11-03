import { DungeonPlannerPage } from "@/pages/DungeonPlannerPage";
import { EquipmentAdvisorPage } from "@/pages/EquipmentAdvisorPage";
import { IntelligencePage } from "@/pages/IntelligencePage";
import { MarketPage } from "@/pages/MarketPage";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NetworthPage } from "@/pages/NetworthPage";
import { ViewPlayerPage } from "@/pages/ViewPlayerPage";
import { BazaarPage } from "@/pages/BazaarPage";
import { AuctionPage } from "@/pages/AuctionPage";
import { CalculatorsPage } from "@/pages/CalculatorsPage";
import { ProgressionPage } from "@/pages/ProgressionPage";
import { WatchlistPage } from "@/pages/WatchlistPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="intelligence" element={<IntelligencePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="dungeons" element={<DungeonPlannerPage />} />
          <Route path="equipment" element={<EquipmentAdvisorPage />} />
          <Route path="networth" element={<NetworthPage />} />
          <Route path="view" element={<ViewPlayerPage />} />
          <Route path="flips" element={<MarketPage />} />
          <Route path="bazaar" element={<BazaarPage />} />
          <Route path="auction" element={<AuctionPage />} />
          <Route path="calculators" element={<CalculatorsPage />} />
          <Route path="progression" element={<ProgressionPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
