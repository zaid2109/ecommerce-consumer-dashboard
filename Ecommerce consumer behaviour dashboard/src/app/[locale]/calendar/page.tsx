import { PageWrapper } from "../../../components/common/PageWrapper";
import { CalendarView } from "../../../components/views/calendar/CalendarView";
import { getData } from "../../../services/getData";

export default async function Calendar() {
  const eventsData = await getData("events");

  return (
    <PageWrapper
      pageName="Calendar"
      dataForExport={eventsData.map((event) => ({
        id: String(event.id ?? ""),
        title: String(event.title ?? ""),
        start: String(event.start ?? ""),
        end: event.end === undefined ? null : String(event.end),
      }))}
    >
      <CalendarView calendarEvents={eventsData} />
    </PageWrapper>
  );
}
