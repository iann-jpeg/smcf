import { Network } from "@capacitor/network";
import { Toast } from "@capacitor/toast";
import { useEffect, useState } from "react";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial status
    const checkStatus = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    };

    checkStatus();

    // Listen for network changes
    const handler = Network.addListener("networkStatusChange", (status) => {
      setIsOnline(status.connected);

      if (!status.connected) {
        Toast.show({
          text: "No internet connection",
          duration: "short",
          position: "bottom",
        });
      } else {
        Toast.show({
          text: "Back online",
          duration: "short",
          position: "bottom",
        });
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  return isOnline;
};
