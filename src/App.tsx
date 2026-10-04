import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ActiveOnly, ClientLayout, RequireFee } from "./components/shell";
import { AppProvider } from "./context/AppState";
import { BanksPage, NotificationsPage, ProfilePage, SecurityPage, SupportPage } from "./pages/account";
import { ForgotPage, LoginPage, OtpPage, RegisterPage, ResetPage, SuspendedPage } from "./pages/auth";
import { DashboardPage } from "./pages/dashboard";
import { ConfirmPage, HoldingPage, IjarahListPage, MudarabahListPage, MyInvestmentsPage, OpportunityPage } from "./pages/invest";
import { KycBank, KycBvn, KycDocs, KycHome, KycNin, KycPersonal, KycReview, KycSelfie, KycStatus } from "./pages/kyc";
import { LandingPage } from "./pages/landing";
import { DepositPage, NotFoundPage, TransactionsPage, WalletPage, WithdrawPage } from "./pages/money";
import { FeeIntroPage, FeePayPage, FeeResultPage } from "./pages/onboarding";
import { AgreementsPage, DocumentsPage, FeesPage, PortfolioPage, ProfitsPage, ReceiptPage, ReceiptsPage } from "./pages/records";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPage />} />
          <Route path="/reset-password" element={<ResetPage />} />
          <Route path="/verify" element={<OtpPage />} />
          <Route path="/suspended" element={<SuspendedPage />} />
          <Route element={<ClientLayout />}>
            <Route path="/onboarding/fee" element={<FeeIntroPage />} />
            <Route path="/onboarding/fee/pay" element={<FeePayPage />} />
            <Route path="/onboarding/fee/success" element={<FeeResultPage outcome="successful" />} />
            <Route path="/onboarding/fee/failed" element={<FeeResultPage outcome="failed" />} />
            <Route path="/onboarding/fee/pending" element={<FeeResultPage outcome="pending" />} />
            <Route element={<RequireFee />}>
              <Route path="/kyc" element={<KycHome />} />
              <Route path="/kyc/personal" element={<KycPersonal />} />
              <Route path="/kyc/nin" element={<KycNin />} />
              <Route path="/kyc/bvn" element={<KycBvn />} />
              <Route path="/kyc/bank" element={<KycBank />} />
              <Route path="/kyc/documents" element={<KycDocs />} />
              <Route path="/kyc/selfie" element={<KycSelfie />} />
              <Route path="/kyc/review" element={<KycReview />} />
              <Route path="/kyc/status" element={<KycStatus />} />
            </Route>
            <Route element={<ActiveOnly />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/deposit" element={<DepositPage />} />
              <Route path="/withdraw" element={<WithdrawPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/invest/mudarabah" element={<MudarabahListPage />} />
              <Route path="/invest/mudarabah/:id" element={<OpportunityPage />} />
              <Route path="/invest/mudarabah/:id/confirm" element={<ConfirmPage />} />
              <Route path="/invest/ijarah" element={<IjarahListPage />} />
              <Route path="/invest/ijarah/:id" element={<OpportunityPage />} />
              <Route path="/invest/ijarah/:id/confirm" element={<ConfirmPage />} />
              <Route path="/investments" element={<MyInvestmentsPage />} />
              <Route path="/investments/:holdingId" element={<HoldingPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/profits" element={<ProfitsPage />} />
              <Route path="/fees" element={<FeesPage />} />
              <Route path="/agreements" element={<AgreementsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/receipts" element={<ReceiptsPage />} />
              <Route path="/receipts/:reference" element={<ReceiptPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/banks" element={<BanksPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
          </Route>
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
