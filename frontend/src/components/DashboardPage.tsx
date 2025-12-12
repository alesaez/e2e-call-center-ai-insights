import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  SentimentSatisfied as SatisfactionIcon,
  People as PeopleIcon,
  TrendingUp as EscalationIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import KPICard from './KPICard';
import apiClient from '../services/apiClient';
import { UIConfig, getTabConfig } from '../services/featureConfig';

// Types for KPI data
interface KPIData {
  totalCalls: number;
  avgHandlingTime: string;
  customerSatisfaction: number;
  agentAvailability: number;
  escalationRate: number;
}

interface ChartData {
  callVolumeTrend: Array<{ date: string; calls: number; answered: number }>;
  callsByHour: Array<{ hour: string; calls: number }>;
  satisfactionBreakdown: Array<{ name: string; value: number }>;
  agentPerformance: Array<{ agent: string; calls: number; avgTime: number; satisfaction: number }>;
}

interface DashboardPageProps {
  uiConfig: UIConfig;
}

export default function DashboardPage({ uiConfig }: DashboardPageProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [kpiResponse, chartResponse] = await Promise.all([
        apiClient.get('/api/dashboard/kpis'),
        apiClient.get('/api/dashboard/charts'),
      ]);
      setKpiData(kpiResponse.data);
      setChartData(chartResponse.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const dashboardTab = getTabConfig(uiConfig, 'dashboard');

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        {dashboardTab?.labels.title || 'Dashboard'}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {dashboardTab?.labels.subtitle || 'Real-time insights for call center operations'}
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KPICard
            title="Total Call Volume"
            value={kpiData?.totalCalls.toLocaleString() || '0'}
            subtitle="Total calls today"
            icon={<PhoneIcon />}
            trend={{ value: 8.5, isPositive: true }}
            loading={loading}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KPICard
            title="Avg Handling Time"
            value={kpiData?.avgHandlingTime || '0:00'}
            subtitle="Minutes per call"
            icon={<AccessTimeIcon />}
            trend={{ value: 3.2, isPositive: false }}
            loading={loading}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KPICard
            title="Customer Satisfaction"
            value={kpiData?.customerSatisfaction ? `${kpiData.customerSatisfaction}/5` : '0/5'}
            subtitle="Average rating"
            icon={<SatisfactionIcon />}
            trend={{ value: 5.1, isPositive: true }}
            loading={loading}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KPICard
            title="Agent Availability"
            value={kpiData?.agentAvailability ? `${kpiData.agentAvailability}%` : '0%'}
            subtitle="Currently available"
            icon={<PeopleIcon />}
            trend={{ value: 2.3, isPositive: true }}
            loading={loading}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KPICard
            title="Escalation Rate"
            value={kpiData?.escalationRate ? `${kpiData.escalationRate}%` : '0%'}
            subtitle="Escalated to supervisor"
            icon={<EscalationIcon />}
            trend={{ value: 1.8, isPositive: false }}
            loading={loading}
            color="error.main"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Call Volume Trend */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader
              title="Call Volume Trend"
              subheader="Last 7 days"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData?.callVolumeTrend || []}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorAnswered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="#0088FE"
                    fillOpacity={1}
                    fill="url(#colorCalls)"
                    name="Total Calls"
                  />
                  <Area
                    type="monotone"
                    dataKey="answered"
                    stroke="#00C49F"
                    fillOpacity={1}
                    fill="url(#colorAnswered)"
                    name="Answered"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Satisfaction Breakdown */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardHeader
              title="Satisfaction Breakdown"
              subheader="Rating distribution"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData?.satisfactionBreakdown || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(chartData?.satisfactionBreakdown || []).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Calls by Hour */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader
              title="Calls by Hour"
              subheader="Today's distribution"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData?.callsByHour || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#0088FE" name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Performance */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardHeader
              title="Top Agents Performance"
              subheader="Calls handled today"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData?.agentPerformance || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="agent" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#00C49F" name="Calls Handled" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
