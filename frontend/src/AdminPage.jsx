import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [peopleBySession, setPeopleBySession] = useState([]);
  const [roomSessionForms, setRoomSessionForms] = useState([]);
  const [csvPayload, setCsvPayload] = useState({
    peopleBySession: "",
    roomSessionForms: {},
    roomSessionFormsAll: ""
  });
  const peopleColumns = useMemo(() => {
    if (!peopleBySession.length) {
      return [];
    }
    return Object.keys(peopleBySession[0]);
  }, [peopleBySession]);
  async function loginAndLoadReports() {
    setError("");
    setLoading(true);
    try {
      const encoded = btoa(`${username}:${password}`);
      const response = await fetch(`${API_BASE}/admin/reports`, {
        headers: {
          Authorization: `Basic ${encoded}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Giriş yapılamadı.");
      }
      setIsLoggedIn(true);
      setPeopleBySession(data.peopleBySession || []);
      setRoomSessionForms(data.roomSessionForms || []);
      setCsvPayload(
        data.csv || { peopleBySession: "", roomSessionForms: {}, roomSessionFormsAll: "" }
      );
    } catch (fetchError) {
      setIsLoggedIn(false);
      setPeopleBySession([]);
      setRoomSessionForms([]);
      setCsvPayload({ peopleBySession: "", roomSessionForms: {}, roomSessionFormsAll: "" });
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", backgroundColor: "#f6f8ff", py: 2 }}>
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h5" fontWeight={700}>
                  Yönetici Raporları
                </Typography>
                <Typography color="text.secondary">
                  CSV dışa aktarımı için yönetici paneli.
                </Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {!isLoggedIn && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      label="Kullanıcı Adı"
                      placeholder="admin"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    <TextField
                      label="Şifre"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      onClick={loginAndLoadReports}
                      disabled={!username || !password || loading}
                    >
                      {loading ? "Yükleniyor..." : "Giriş Yap"}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {isLoggedIn && (
            <>
              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                    >
                      <Typography variant="h6">Katılımcılar ve Saatlere Göre Atölye Seçimleri</Typography>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          downloadCsv("katilimcilar-ve-atolye-secimleri.csv", csvPayload.peopleBySession)
                        }
                      >
                        CSV İndir
                      </Button>
                    </Stack>
                    <TableContainer sx={{ overflowX: "auto" }}>
                      <Table size="small" sx={{ minWidth: 820 }}>
                        <TableHead>
                          <TableRow>
                            {peopleColumns.map((column) => (
                              <TableCell key={column}>{column}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {peopleBySession.map((row) => (
                            <TableRow key={row["Katılımcı No"]}>
                              {peopleColumns.map((column) => (
                                <TableCell key={column}>{row[column]}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                </CardContent>
              </Card>

              {roomSessionForms.map((form) => (
                <Card key={form.room}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                      >
                        <Typography variant="h6">{form.room} - Saat Dilimlerine Göre Katılımcılar</Typography>
                        <Button
                          variant="outlined"
                          onClick={() =>
                            downloadCsv(
                              `${form.room.toLowerCase().replace(/\s+/g, "-")}-katilimcilar.csv`,
                              csvPayload.roomSessionForms?.[form.room] || ""
                            )
                          }
                        >
                          CSV İndir
                        </Button>
                      </Stack>
                      <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small" sx={{ minWidth: 720 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Katılımcı No</TableCell>
                              {form.timeSlots.map((slot) => (
                                <TableCell key={slot}>{slot}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {form.rows.map((row) => (
                              <TableRow key={`${form.room}-${row.attendeeNo}`}>
                                <TableCell>{row.attendeeNo}</TableCell>
                                {form.timeSlots.map((slot) => (
                                  <TableCell key={slot}>{row[slot]}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                  >
                    <Typography variant="h6">Tüm Atölyeler (Tek CSV)</Typography>
                    <Button
                      variant="contained"
                      onClick={() =>
                        downloadCsv(
                          "tum-atolyeler-ve-oturum-formlari.csv",
                          csvPayload.roomSessionFormsAll || ""
                        )
                      }
                    >
                      Tümünü CSV Olarak İndir
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

export default AdminPage;
