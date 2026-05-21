import HomePage from "../HomePage";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function HomePageExample() {
  return (
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  );
}
