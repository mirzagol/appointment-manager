import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const STEPS = {
  intro: "intro",
  userInfo: "userInfo",
  phone: "phone",
  sessions: "sessions",
  confirm: "confirm"
};

function App() {
  const [step, setStep] = useState(STEPS.intro);
  const [userInfo, setUserInfo] = useState({
    name: "",
    lastName: "",
    age: ""
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmationRef = useRef(null);

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [sessions, selectedSessionIds]
  );

  const sessionsByTime = useMemo(() => {
    const grouped = {};
    for (const session of sessions) {
      const key = `${session.startTime}-${session.endTime}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(session);
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.roomId - b.roomId);
    }
    return grouped;
  }, [sessions]);

  const timeKeys = useMemo(() => Object.keys(sessionsByTime), [sessionsByTime]);

  useEffect(() => {
    if (step === STEPS.sessions) {
      fetchSessions();
    }
  }, [step]);

  async function fetchSessions() {
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load sessions.");
      }
      setSessions(data.sessions);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }

  async function createUser() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userInfo,
          age: Number(userInfo.age),
          phoneNumber
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "User registration failed.");
      }
      setUser(data);
      setSuccess("User registered successfully.");
      setStep(STEPS.sessions);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSession(targetSession) {
    setError("");
    setSuccess("");
    const isSelected = selectedSessionIds.includes(targetSession.id);
    if (isSelected) {
      setSelectedSessionIds((prev) => prev.filter((id) => id !== targetSession.id));
      return;
    }

    if (selectedSessionIds.length >= 4) {
      setError("You can select at most 4 rooms.");
      return;
    }

    const existingSameRoom = selectedSessions.some(
      (session) => session.roomId === targetSession.roomId
    );
    if (existingSameRoom) {
      setError("You can only pick one session per room.");
      return;
    }

    const existingSameTime = selectedSessions.some(
      (session) =>
        session.startTime === targetSession.startTime &&
        session.endTime === targetSession.endTime
    );
    if (existingSameTime) {
      setError("You can only pick one room per time slot.");
      return;
    }

    setSelectedSessionIds((prev) => [...prev, targetSession.id]);
  }

  async function submitReservations() {
    if (!user) {
      setError("User registration is required.");
      return;
    }
    if (selectedSessionIds.length === 0) {
      setError("Select at least one session.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const sessionId of selectedSessionIds) {
        const response = await fetch(`${API_BASE}/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            sessionId
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Booking failed.");
        }
      }

      setSuccess("Reservations completed.");
      setStep(STEPS.confirm);
    } catch (reservationError) {
      setError(reservationError.message);
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  }

  async function saveAsImage() {
    if (!confirmationRef.current) {
      return;
    }
    const canvas = await html2canvas(confirmationRef.current, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `appointment-confirmation-${user?.id || "user"}.png`;
    link.href = image;
    link.click();
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Event Appointment Manager</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {step === STEPS.intro && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Welcome</Typography>
                <Typography>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Please
                  complete your information and choose your preferred sessions.
                </Typography>
                <Button variant="contained" onClick={() => setStep(STEPS.userInfo)}>
                  Start Registration
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.userInfo && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Personal Information</Typography>
                <TextField
                  label="Name"
                  value={userInfo.name}
                  onChange={(event) =>
                    setUserInfo((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
                <TextField
                  label="Last Name"
                  value={userInfo.lastName}
                  onChange={(event) =>
                    setUserInfo((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                />
                <TextField
                  label="Age"
                  type="number"
                  value={userInfo.age}
                  onChange={(event) =>
                    setUserInfo((prev) => ({ ...prev, age: event.target.value }))
                  }
                />
                <Button
                  variant="contained"
                  onClick={() => setStep(STEPS.phone)}
                  disabled={!userInfo.name || !userInfo.lastName || !userInfo.age}
                >
                  Continue
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.phone && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Phone Number</Typography>
                <TextField
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
                <Button
                  variant="contained"
                  onClick={createUser}
                  disabled={!phoneNumber || loading}
                >
                  {loading ? "Registering..." : "Create User"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.sessions && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Select Sessions</Typography>
                <Typography variant="body2">
                  Pick up to 4 sessions. One session per room and one room per time slot.
                </Typography>
                {timeKeys.map((timeKey) => (
                  <Box key={timeKey}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {timeKey.replace("-", " - ")}
                    </Typography>
                    <Grid container spacing={1}>
                      {sessionsByTime[timeKey].map((session) => {
                        const selected = selectedSessionIds.includes(session.id);
                        const disabled = session.isFull && !selected;
                        return (
                          <Grid item xs={12} sm={6} md={4} key={session.id}>
                            <Button
                              fullWidth
                              variant={selected ? "contained" : "outlined"}
                              color={session.isFull ? "error" : "primary"}
                              onClick={() => toggleSession(session)}
                              disabled={disabled || loading}
                            >
                              {session.roomName} ({session.availableSpots} left)
                            </Button>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                ))}
                <Typography variant="body2">
                  Selected: {selectedSessionIds.length} / 4
                </Typography>
                <Button variant="contained" onClick={submitReservations} disabled={loading}>
                  {loading ? "Saving..." : "Confirm Reservations"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.confirm && (
          <Card ref={confirmationRef}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Confirmation</Typography>
                <Typography>
                  Name: {user?.name} {user?.lastName}
                </Typography>
                <Typography>Phone: {user?.phoneNumber}</Typography>
                <Typography variant="subtitle1">Booked Sessions</Typography>
                {selectedSessions.map((session) => (
                  <Typography key={session.id}>
                    {session.roomName} | {session.startTime}-{session.endTime}
                  </Typography>
                ))}
                <Button variant="contained" onClick={saveAsImage}>
                  Save as Image
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

export default App;
