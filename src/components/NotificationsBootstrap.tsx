import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import { useTaskReminderEngine } from "@/hooks/useTaskReminderEngine";
import { EnableNotificationsBanner } from "@/components/EnableNotificationsBanner";

export function NotificationsBootstrap() {
  useTaskNotifications();
  useTaskReminderEngine();
  return <EnableNotificationsBanner />;
}
