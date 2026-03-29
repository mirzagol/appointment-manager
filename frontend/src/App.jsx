import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Step,
  StepLabel,
  Stepper,
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

const STEP_ORDER = [
  STEPS.intro,
  STEPS.userInfo,
  STEPS.phone,
  STEPS.sessions,
  STEPS.confirm
];

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
  const activeStep = STEP_ORDER.indexOf(step);

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

  function replaceSelection(nextSession, reason) {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    let updatedSelectionIds = [...selectedSessionIds];
    const reasonMessage = {
      room: "Selection updated: replaced your previous choice for this room.",
      time: "Selection updated: replaced your previous choice in this time slot.",
      max: "Selection updated: replaced your earliest pick to keep 4 selections."
    };

    if (reason === "room") {
      updatedSelectionIds = updatedSelectionIds.filter((id) => {
        const selectedSession = byId.get(id);
        return selectedSession?.roomId !== nextSession.roomId;
      });
    }
    if (reason === "time") {
      updatedSelectionIds = updatedSelectionIds.filter((id) => {
        const selectedSession = byId.get(id);
        return !(
          selectedSession?.startTime === nextSession.startTime &&
          selectedSession?.endTime === nextSession.endTime
        );
      });
    }
    if (reason === "max") {
      updatedSelectionIds = updatedSelectionIds.slice(1);
    }

    updatedSelectionIds.push(nextSession.id);
    setSelectedSessionIds(updatedSelectionIds);
    setSuccess(reasonMessage[reason]);
  }

  function toggleSession(targetSession) {
    setError("");
    setSuccess("");
    const isSelected = selectedSessionIds.includes(targetSession.id);
    if (isSelected) {
      setSelectedSessionIds((prev) => prev.filter((id) => id !== targetSession.id));
      return;
    }

    const existingSameRoom = selectedSessions.find(
      (session) => session.roomId === targetSession.roomId
    );
    if (existingSameRoom) {
      replaceSelection(targetSession, "room");
      return;
    }

    const existingSameTime = selectedSessions.find(
      (session) =>
        session.startTime === targetSession.startTime &&
        session.endTime === targetSession.endTime
    );
    if (existingSameTime) {
      replaceSelection(targetSession, "time");
      return;
    }

    if (selectedSessionIds.length >= 4) {
      replaceSelection(targetSession, "max");
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

  function exitToIntro() {
    setStep(STEPS.intro);
    setUserInfo({ name: "", lastName: "", age: "" });
    setPhoneNumber("");
    setUser(null);
    setSessions([]);
    setSelectedSessionIds([]);
    setError("");
    setSuccess("");
    setLoading(false);
  }

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            background:
              "linear-gradient(135deg, rgba(25,118,210,0.10) 0%, rgba(156,39,176,0.10) 100%)"
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>EV</Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Event Appointment Manager
              </Typography>
              <Typography color="text.secondary">
                Book up to 4 sessions with smart availability and instant confirmation.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            <Step>
              <StepLabel>Welcome</StepLabel>
            </Step>
            <Step>
              <StepLabel>Profile</StepLabel>
            </Step>
            <Step>
              <StepLabel>Phone</StepLabel>
            </Step>
            <Step>
              <StepLabel>Sessions</StepLabel>
            </Step>
            <Step>
              <StepLabel>Confirm</StepLabel>
            </Step>
          </Stepper>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {step === STEPS.intro && (
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={700}>
                  Welcome
                </Typography>
                <Typography color="text.secondary">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Please
                  complete your information and choose your preferred sessions.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip label="6 Rooms" color="primary" />
                  <Chip label="4 Time Slots" color="secondary" />
                  <Chip label="Max 4 Selections" />
                </Stack>
                <Button variant="contained" size="large" onClick={() => setStep(STEPS.userInfo)}>
                  Start Registration
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.userInfo && (
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Personal Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={userInfo.name}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={userInfo.lastName}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Age"
                      type="number"
                      value={userInfo.age}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, age: event.target.value }))
                      }
                    />
                  </Grid>
                </Grid>
                <Button
                  variant="contained"
                  size="large"
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
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Phone Number
                </Typography>
                <TextField
                  label="Phone Number"
                  fullWidth
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
                <Button
                  variant="contained"
                  size="large"
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
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Select Sessions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pick up to 4 sessions. Selecting another session in the same room or
                  time slot automatically replaces your previous choice.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip label={`Selected: ${selectedSessionIds.length} / 4`} color="primary" />
                  <Chip label="Auto-replace on conflicts" variant="outlined" />
                </Stack>
                {timeKeys.map((timeKey) => (
                  <Paper key={timeKey} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      {timeKey.replace("-", " - ")}
                    </Typography>
                    <Grid container spacing={1.5}>
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
                              sx={{
                                py: 1.3,
                                justifyContent: "space-between"
                              }}
                            >
                              {session.roomName} - {session.availableSpots} left
                            </Button>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                ))}
                <Button
                  variant="contained"
                  size="large"
                  onClick={submitReservations}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Confirm Reservations"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.confirm && (
          <Card ref={confirmationRef} sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6" fontWeight={700}>
                  Confirmation
                </Typography>
                <Typography>
                  Name: {user?.name} {user?.lastName}
                </Typography>
                <Typography>Phone: {user?.phoneNumber}</Typography>
                <Divider />
                <Typography variant="subtitle1">Booked Sessions</Typography>
                {selectedSessions.map((session) => (
                  <Chip
                    key={session.id}
                    label={`${session.roomName} | ${session.startTime}-${session.endTime}`}
                    variant="outlined"
                  />
                ))}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button variant="contained" onClick={saveAsImage}>
                    Save as Image
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={exitToIntro}>
                    Exit
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

export default App;
