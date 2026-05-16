const { scrapeCompanyWebsite } = require('./scraper');
const { generateAuditReport } = require('./aiReport');
const { generatePdfReport } = require('./pdfGenerator');
const { sendReportEmail } = require('./emailSender');

const PIPELINE_VERSION = 'phase7-complete-v1';
const DEBUG = process.env.DEBUG_PIPELINE === 'true';

function debug(requestId, message, meta) {
  if (!DEBUG) return;
  if (meta !== undefined) {
    console.log(`[DEBUG] [${requestId}] ${message}`, meta);
  } else {
    console.log(`[DEBUG] [${requestId}] ${message}`);
  }
}

function logStep(step, requestId, message, meta) {
  const time = new Date().toISOString();
  const prefix = `[${time}] [${step}]`;
  if (meta !== undefined) {
    console.log(prefix, `Request ${requestId} — ${message}`, meta);
  } else {
    console.log(prefix, `Request ${requestId} — ${message}`);
  }
}

function buildUserMessage(lead, workflow) {
  if (workflow.status === 'complete') {
    return `Your personalized audit for ${lead.companyName} was generated and sent to ${lead.email}. Please check your inbox (and spam folder).`;
  }
  if (workflow.status === 'email_failed') {
    return `Your audit PDF was created, but we could not email it automatically. Our team has been notified via saved report.`;
  }
  if (workflow.status === 'pdf_failed') {
    return `We analyzed your business, but PDF generation failed. Please try again in a few minutes.`;
  }
  if (workflow.status === 'partial') {
    return `Your audit was generated with limited website data and emailed to ${lead.email}.`;
  }
  return 'Your request was received and is being processed.';
}

/**
 * Run full lead automation: scrape → AI → PDF → email.
 * Continues when scrape fails (degraded mode). Never throws.
 */
async function runLeadPipeline(lead, requestId) {
  const startedAt = new Date().toISOString();
  const workflow = {
    status: 'processing',
    steps: {},
  };

  try {
    debug(requestId, 'pipeline started', { company: lead.companyName });

    logStep('SCRAPE', requestId, 'started', { url: lead.companyWebsite });
    const scrapedData = await scrapeCompanyWebsite(lead.companyWebsite);
    workflow.steps.scrape = {
      state: scrapedData.success ? 'completed' : 'degraded',
      success: scrapedData.success,
      title: scrapedData.title || null,
      error: scrapedData.error,
    };
    logStep('SCRAPE', requestId, 'finished', workflow.steps.scrape);
    debug(requestId, 'scrape result', scrapedData);

    logStep('AI', requestId, 'started');
    const reportData = await generateAuditReport(lead, scrapedData);
    workflow.steps.ai = {
      state: 'completed',
      success: reportData.success,
      source: reportData.source,
      model: reportData.model,
    };
    logStep('AI', requestId, 'finished', workflow.steps.ai);
    debug(requestId, 'AI report ready', workflow.steps.ai);

    logStep('PDF', requestId, 'started');
    const pdfResult = await generatePdfReport(lead, reportData);
    workflow.steps.pdf = {
      state: pdfResult.success ? 'completed' : 'failed',
      success: pdfResult.success,
      fileName: pdfResult.fileName,
      error: pdfResult.error,
    };
    logStep('PDF', requestId, 'finished', workflow.steps.pdf);
    debug(requestId, 'PDF result', pdfResult);

    let emailResult = {
      success: false,
      messageId: null,
      to: lead.email,
      error: 'Skipped — PDF was not generated',
    };

    if (pdfResult.success) {
      logStep('EMAIL', requestId, 'started', { to: lead.email });
      emailResult = await sendReportEmail(lead, pdfResult.filePath, reportData);
      workflow.steps.email = {
        state: emailResult.success ? 'completed' : 'failed',
        success: emailResult.success,
        to: emailResult.to,
        error: emailResult.error,
      };
      logStep('EMAIL', requestId, 'finished', workflow.steps.email);
    } else {
      workflow.steps.email = {
        state: 'skipped',
        success: false,
        to: lead.email,
        error: emailResult.error,
      };
      logStep('EMAIL', requestId, 'skipped (no PDF)');
    }

    debug(requestId, 'email result', emailResult);

    if (emailResult.success) {
      workflow.status = scrapedData.success ? 'complete' : 'partial';
    } else if (pdfResult.success) {
      workflow.status = 'email_failed';
    } else {
      workflow.status = 'pdf_failed';
    }

    const summaryPreview = reportData.sections?.companySummary?.slice(0, 160) || '';
    const workflowComplete = workflow.status === 'complete' || workflow.status === 'partial';

    logStep('PIPELINE', requestId, 'complete', { status: workflow.status });

    return {
      httpStatus: 200,
      body: {
        success: workflowComplete,
        code: workflow.status.toUpperCase(),
        pipelineVersion: PIPELINE_VERSION,
        message: buildUserMessage(lead, workflow),
        requestId,
        startedAt,
        completedAt: new Date().toISOString(),
        lead: {
          name: lead.name,
          email: lead.email,
          companyName: lead.companyName,
          companyWebsite: lead.companyWebsite,
        },
        workflow,
        scrapeData: scrapedData,
        reportData: {
          success: reportData.success,
          source: reportData.source,
          model: reportData.model,
          generatedAt: reportData.generatedAt,
          error: reportData.error,
          summaryPreview:
            summaryPreview + (summaryPreview.length >= 160 ? '...' : ''),
        },
        pdf: {
          success: pdfResult.success,
          fileName: pdfResult.fileName,
          filePath: pdfResult.filePath,
          fileSize: pdfResult.fileSize,
          error: pdfResult.error,
        },
        email: {
          success: emailResult.success,
          to: emailResult.to,
          messageId: emailResult.messageId,
          error: emailResult.error,
        },
      },
    };
  } catch (err) {
    logStep('PIPELINE', requestId, 'failed', { error: err.message });
    return {
      httpStatus: 500,
      body: {
        success: false,
        code: 'PIPELINE_ERROR',
        pipelineVersion: PIPELINE_VERSION,
        message: 'Something went wrong while processing your request. Please try again.',
        requestId,
        error: err.message,
      },
    };
  }
}

module.exports = {
  runLeadPipeline,
  PIPELINE_VERSION,
};
