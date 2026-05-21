import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import HomePage from "@/pages/HomePage";
import UploadPage from "@/pages/UploadPage";
import MemberDetailPage from "@/pages/MemberDetailPage";
import ContestDetailPage from "@/pages/ContestDetailPage";
import ContestsListPage from "@/pages/ContestsListPage";
import AdminPage from "@/pages/AdminPage";
import AllSubmissionsPage from "@/pages/AllSubmissionsPage";
import MembersListPage from "@/pages/MembersListPage";
import OperatorDetailPage from "@/pages/OperatorDetailPage";
import SubmissionDetailPage from "@/pages/SubmissionDetailPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/member/:callsign" component={MemberDetailPage} />
      <Route path="/operator/:callsign" component={OperatorDetailPage} />
      <Route path="/contest/:key" component={ContestDetailPage} />
      <Route path="/contests" component={ContestsListPage} />
      <Route path="/skipper" component={AdminPage} />
      <Route path="/submission/:id" component={SubmissionDetailPage} />
      <Route path="/submissions" component={AllSubmissionsPage} />
      <Route path="/members" component={MembersListPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
