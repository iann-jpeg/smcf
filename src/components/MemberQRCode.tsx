import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Download, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface MemberQRCodeProps {
  userData: any;
}

const MemberQRCode = ({ userData }: MemberQRCodeProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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
    const svg = document.getElementById('member-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    canvas.width = 300;
    canvas.height = 300;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
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

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

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
            <QRCodeSVG
              id="member-qr-code"
              value={qrValue}
              size={200}
              level="H"
              includeMargin={true}
              fgColor="#1e40af"
              bgColor="#ffffff"
            />
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
            size="sm">
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
