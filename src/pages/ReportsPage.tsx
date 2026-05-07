'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileText, AlertTriangle, BarChart3, Users } from 'lucide-react';
import { toast } from 'sonner';

// ✅ PRODUCTION FIX: Removed unused 'Legend' import
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';

// ✅ PRODUCTION TRUTH: Defines exactly what apiFetch hands to us after unwrapping
interface ReportData {
  attendance: {
    service: string;
    adultMale: number;
    adultFemale: number;
    youthBoys: number;
    youthGirls: number;
    childrenBoys: number;
    childrenGirls: number;
    peakDate: string;
    peakTotal: number;
  }[];
  newcomers: {
    service: string;
    adultMale: number;
    adultFemale: number;
    youthBoys: number;
    youthGirls: number;
    childrenBoys: number;
    childrenGirls: number;
  }[];
  trendData: Record<string, string | number>[];
}

export default function ReportsPage() {
  const user = useAppStore((s) => s.user);
  const locationName = user?.scopeNames?.locationName || 'Unknown Location';
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
 const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    useEffect(() => {
    if (!startDate || !endDate) return;
    
    const fetchReportData = async () => {
      setIsGenerating(true);
      try {
      
        const res = await apiFetch<ReportData>('/api/reports', {
          method: 'POST',
          body: JSON.stringify({ start: startDate, end: endDate })
        });
        
       
        if (res && res.attendance && res.trendData) {
          setReportData(res);
        }
      } catch (error) {
        toast.error('Failed to fetch report data');
      } finally {
        setIsGenerating(false);
      }
    };

    fetchReportData();
  }, [startDate, endDate]);

  // ✅ PRODUCTION FIX: Strictly typed helper added inside component
  const getMonthSeparators = (data: Record<string, string | number>[]) => {
    const separators: { label: string }[] = [];
    let lastMonth = '';
    
    if (!data || data.length === 0) return separators;

    data.forEach((item) => {
      const weekStr = String(item.week); // Strict string cast
      const parts = weekStr.split(', ');
      if (parts.length < 2) return;
      
      const currentMonth = parts[1]; // Extract "Jan" from "W1, Jan"
      
      if (currentMonth !== lastMonth) {
        if (lastMonth !== '') { // Don't draw a line at the very first month
          separators.push({ label: weekStr });
        }
        lastMonth = currentMonth;
      }
    });
    
    return separators;
  };

  // --- EXPORT LOGIC ---
  const triggerDownload = (format: 'csv' | 'pdf') => {
    if (!reportData) return toast.error('No data to export');
    
    const safeLocationName = locationName.replace(/[^a-z0-9]/gi, '_');
    const fileNameBase = `DLBC_Report_${safeLocationName}_${startDate}_to_${endDate}`;

    if (format === 'csv') {
      let csv = `ATTENDANCE SUMMARY (Highest Single Day)\nLocation: ${locationName}\nRange: ${formatDate(startDate)} - ${formatDate(endDate)}\n\n`;
      csv += `Service,Adult Male,Adult Female,Youth Boys,Youth Girls,Children Boys,Children Girls,Peak Date\n`;
      
      reportData.attendance.forEach((row) => {
        csv += `${row.service},${row.adultMale},${row.adultFemale},${row.youthBoys},${row.youthGirls},${row.childrenBoys},${row.childrenGirls},"${formatDate(row.peakDate)}"\n`;
      });
      
      csv += `\nNEWCOMER TOTALS (Range Sum)\nService,Adult Male,Adult Female,Youth Boys,Youth Girls,Children Boys,Children Girls\n`;
      if (reportData.newcomers.length === 0) {
        csv += `No Newcomer\n`;
      } else {
        reportData.newcomers.forEach((row) => {
          csv += `${row.service},${row.adultMale},${row.adultFemale},${row.youthBoys},${row.youthGirls},${row.childrenBoys},${row.childrenGirls}\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileNameBase}.csv`;
      link.click();
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`DEEPER LIFE BIBLE CHURCH - ${locationName.toUpperCase()}`, 14.5, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`ATTENDANCE SUMMARY: ${formatDate(startDate)} — ${formatDate(endDate)}`, 14.5, 28);

      const attendanceBody = reportData.attendance.map((row) => [
        row.service, row.adultMale, row.adultFemale, row.youthBoys, row.youthGirls, row.childrenBoys, row.childrenGirls, `Peak: ${formatDate(row.peakDate)}`
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['SERVICE', 'ADULT (M)', 'ADULT (F)', 'YOUTH (B)', 'YOUTH (G)', 'CHILDREN (B)', 'CHILDREN (G)', 'NOTE']],
        body: attendanceBody,
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52], fontStyle: 'bold' },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 7: { fontStyle: 'italic', fontSize: 8 } }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text('NEWCOMER SUMMARY', 14.5, finalY);

      if (reportData.newcomers.length === 0) {
         doc.setFontSize(10);
         doc.setFont('helvetica', 'italic');
         doc.text('No Newcomer recorded for this date range.', 14.5, finalY + 10);
      } else {
        const newcomerBody = reportData.newcomers.map((row) => [
          row.service, row.adultMale, row.adultFemale, row.youthBoys, row.youthGirls, row.childrenBoys, row.childrenGirls
        ]);

        autoTable(doc, {
          startY: finalY + 5,
          head: [['SERVICE', 'ADULT (M)', 'ADULT (F)', 'YOUTH (B)', 'YOUTH (G)', 'CHILDREN (B)', 'CHILDREN (G)']],
          body: newcomerBody,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold' },
          styles: { fontSize: 9, halign: 'center' },
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
        });
      }

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Powered by: Xuzentra Technologies Limited', doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
      doc.save(`${fileNameBase}.pdf`);
    }
    
    toast.success(`${format.toUpperCase()} downloaded successfully`);
  };

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-16">
      {/* Header & Filters */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Reports & Analytics</h2>
        <p className="text-sm text-muted-foreground">Peak attendance by service and total newcomer headcounts.</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl bg-secondary/50 border-0" />
          </div>
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 rounded-xl bg-secondary/50 border-0" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => triggerDownload('csv')} variant="outline" className="h-11 flex-1 sm:flex-initial rounded-xl gap-2 border-church-green text-church-green hover:bg-church-green/10">
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button onClick={() => triggerDownload('pdf')} className="h-11 flex-1 sm:flex-initial rounded-xl bg-church-green hover:bg-church-green-light text-white gap-2">
              <FileText className="w-4 h-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 0: CONTINUOUS TREND GRAPH */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-church-green/5 px-4 py-3 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-church-green" />
            <h3 className="text-sm font-bold text-foreground">Church Growth Trend (Adults Only)</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600 inline-block"></span> Sunday</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> Bible Study</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black inline-block"></span> Revival</span>
          </div>
        </div>

        <div className="p-4 bg-white">
          {reportData?.trendData && reportData.trendData.length > 0 ? (
            <div className="w-full h-[300px] md:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData.trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    allowDecimals={false}
                    domain={[0, 'auto']} 
                  />
                  <Tooltip 
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} 
                  />
                  
                  {/* Dynamic Month Separator Gridlines */}
                  {getMonthSeparators(reportData.trendData).map((pos, i) => (
                    <ReferenceLine key={i} x={pos.label} stroke="#cbd5e1" strokeDasharray="0" />
                  ))}

                  <Line 
                    type="monotone" 
                    dataKey="Sunday Worship Service" 
                    stroke="#16a34a" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, fill: "#16a34a" }} 
                    activeDot={{ r: 6 }} 
                    connectNulls 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Monday Bible Study" 
                    stroke="#2563eb" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, fill: "#2563eb" }} 
                    activeDot={{ r: 6 }} 
                    connectNulls 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Revival Hour" 
                    stroke="#000000" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, fill: "#000000" }} 
                    activeDot={{ r: 6 }} 
                    connectNulls 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              {isGenerating ? 'Calculating trend...' : 'No attendance data available to plot trend.'}
            </div>
          )}
        </div>
      </Card>

      {/* SECTION A: ATTENDANCE TABLE */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-church-green/5 px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-church-green" />
            <h3 className="text-sm font-bold text-foreground">Attendance Summary (Peak Day)</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">{formatDate(startDate)} — {formatDate(endDate)}</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
              <tr>
                <th className="px-4 py-3 font-medium text-left">Service Type</th>
                <th className="px-4 py-3 font-medium text-center">Adult M</th>
                <th className="px-4 py-3 font-medium text-center">Adult F</th>
                <th className="px-4 py-3 font-medium text-center">Youth B</th>
                <th className="px-4 py-3 font-medium text-center">Youth G</th>
                <th className="px-4 py-3 font-medium text-center">Child B</th>
                <th className="px-4 py-3 font-medium text-center">Child G</th>
                <th className="px-4 py-3 font-medium text-right">Peak Date</th>
              </tr>
            </thead>
            <tbody>
              {isGenerating ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm animate-pulse">Calculating peak attendance...</td></tr>
              ) : reportData?.attendance && reportData.attendance.length > 0 ? (
                reportData.attendance.map((row) => (
                  <tr key={row.service} className="hover:bg-secondary/20 transition-colors border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.service}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.adultMale}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.adultFemale}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.youthBoys}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.youthGirls}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.childrenBoys}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.childrenGirls}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground text-right">{formatDate(row.peakDate)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">No attendance data found for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION B: NEWCOMER TABLE */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-foreground">Newcomer Summary (Total Headcount)</h3>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">
            {reportData?.newcomers?.length || 0} Services with Data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
              <tr>
                <th className="px-4 py-3 font-medium text-left">Service Type</th>
                <th className="px-4 py-3 font-medium text-center">Adult M</th>
                <th className="px-4 py-3 font-medium text-center">Adult F</th>
                <th className="px-4 py-3 font-medium text-center">Youth B</th>
                <th className="px-4 py-3 font-medium text-center">Youth G</th>
                <th className="px-4 py-3 font-medium text-center">Child B</th>
                <th className="px-4 py-3 font-medium text-center">Child G</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.newcomers && reportData.newcomers.length > 0 ? (
                reportData.newcomers.map((row) => (
                  <tr key={row.service} className="hover:bg-secondary/20 transition-colors border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.service}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.adultMale}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.adultFemale}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.youthBoys}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.youthGirls}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.childrenBoys}</td>
                    <td className="px-4 py-3 font-mono text-center">{row.childrenGirls}</td>
                  </tr>
                ))
              ) : (
                !isGenerating && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-yellow-500 opacity-50" />
                      <span className="text-sm font-medium">No Newcomer</span>
                      <p className="text-xs mt-1">No newcomer headcounts recorded for this date range.</p>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-center text-[10px] text-muted-foreground pt-2">Powered by: Xuzentra Technologies Limited</p>
    </div>
  );
}