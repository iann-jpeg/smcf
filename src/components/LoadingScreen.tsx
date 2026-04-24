import smcfLogo from "@/assets/newsmcflogo.png";
import { StyledSMCF } from "./StyledSMCF";
import "./LoadingScreen.css";

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-primary/5">
      <div className="text-center">
        {/* Logo with pulse animation */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <img 
            src={smcfLogo} 
            alt="SMCF Logo" 
            className="w-24 h-24 mx-auto relative z-10 animate-float"
          />
        </div>
        
        {/* Brand name with fade animation */}
        <div className="mb-8 animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-2">
            <StyledSMCF />
          </h2>
          <p className="text-sm text-muted-foreground">Smart Moves Cash Flow</p>
        </div>

        {/* Modern loading bars */}
        <div className="flex gap-2 justify-center mb-4">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce loading-dot" />
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce loading-dot loading-dot--150" />
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce loading-dot loading-dot--300" />
        </div>

        {/* Loading text */}
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading your dashboard...
        </p>
      </div>
    </div>
  );
};
