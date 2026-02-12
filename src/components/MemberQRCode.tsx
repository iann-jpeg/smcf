import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect, Component, ReactNode, lazy, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Lazy load QRCodeSVG to prevent constructor issues
const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((module) => ({
    default: module.QRCodeSVG,
  })).catch((error) => {
    console.error("Failed to load QR code library:", error);
    // Return a placeholder component if loading fails
    return {
      default: () => (
        <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      ),
    };
  })
);

interface MemberQRCodeProps {
  userData: any;
}

// Error Boundary for QR Code rendering
class ErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('QR Code render error:', error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const MemberQRCode = ({ userData }: MemberQRCodeProps) => {
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  // Ensure component only renders QR code on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate unique payment data for this member
  const paymentData = {
    type: "SMCF_WALLET_DEPOSIT",
    memberId: userData?.member_id || userData?.memberId,
    memberName: userData?.name,
    userId: userData?._id || userData?.id,
    timestamp: Date.now(),
  };

  const qrValue = JSON.stringify(paymentData);

  const handleCopyQRData = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    toast({
      title: "QR Data Copied",
      description: "Payment QR data copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    try {
      const svg = document.getElementById('member-qr-code');
      if (!svg) {
        toast({
          title: "Error",
          description: "QR code not found",
          variant: "destructive",
        });
        return;
      }

      // Use outerHTML instead of XMLSerializer for better compatibility
      const svgData = svg.outerHTML;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        toast({
          title: "Error",
          description: "Canvas not supported",
          variant: "destructive",
        });
        return;
      }

      // Create Image element safely
      const img = document.createElement('img') as HTMLImageElement;

      canvas.width = 300;
      canvas.height = 300;

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `SMCF-QR-${userData?.member_id || 'member'}.png`;
            link.click();
            URL.revokeObjectURL(url);
            toast({
              title: "QR Code Downloaded",
              description: "Your payment QR code has been saved",
            });
          }
        });
      };

      img.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to process QR code image",
          variant: "destructive",
        });
      };

      // Encode SVG data for use in image source
      const encodedData = btoa(unescape(encodeURIComponent(svgData)));
      img.src = 'data:image/svg+xml;base64,' + encodedData;
    } catch (error) {
      console.error('QR download error:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Don't render QR code if userData is missing
  if (!userData || (!userData.member_id && !userData.memberId)) {
    return (
      <Card className="border-2 border-blue-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-blue-700">
            <span className="text-2xl">📱</span>
            Your Payment QR Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Loading your QR code...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-blue-700">
          <span className="text-2xl">📱</span>
          Your Payment QR Code
        </CardTitle>
        <CardDescription>
          Unique QR code for receiving wallet deposits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="bg-white p-6 rounded-lg border-4 border-blue-500 shadow-lg">
            {/* Only render QR code on client-side and if no error */}
            {isClient && !qrError ? (
              <ErrorBoundary onError={() => setQrError(true)}>
                <Suspense
                  fallback={
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                    </div>
                  }
                >
                  <QRCodeSVG
                    id="member-qr-code"
                    value={qrValue}
                    size={200}
                    level="H"
                    includeMargin={true}
                    fgColor="#1e40af"
                    bgColor="#ffffff"
                  />
                </Suspense>
              </ErrorBoundary>
            ) : qrError ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded">
                <div className="text-center p-4">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-xs text-gray-600">QR code unavailable</p>
                </div>
              </div>
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-center">
            <div className="font-bold text-lg text-blue-700">
              {userData?.name}
            </div>
            <div className="text-sm text-muted-foreground">
              Member ID: {userData?.member_id || userData?.memberId}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm text-blue-900">How to use:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Share this QR code to receive wallet deposits</li>
            <li>• Sender scans your QR code with the SMCF app</li>
            <li>• Money is deposited directly to your wallet</li>
            <li>• You receive instant notification</li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDownloadQR}
            variant="default"
            className="flex-1"
            size="sm"
            disabled={qrError}>
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>
          <Button
            onClick={handleCopyQRData}
            variant="outline"
            className="flex-1"
            size="sm">
            {copied ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? "Copied!" : "Copy Data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberQRCode;
