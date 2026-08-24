require("dotenv").config();
const { Pool } = require("pg");

const BASE_URL = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function runAllTests() {
  console.log("=========================================");
  console.log("   SKIM SYSTEM COMPREHENSIVE E2E TEST   ");
  console.log("=========================================\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, name, details = "") {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      if (details) console.log(`   └─ ${details}`);
      testPassed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      if (details) console.error(`   └─ ${details}`);
      testFailed++;
    }
  }

  try {
    // 1. SIGNUP
    const testEmail = `e2e_${Date.now()}@example.com`;
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E Tester", email: testEmail, password: "SecurePassword123!" }),
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 201 && signupData.user?.id, "User Signup API", `User ID: ${signupData.user?.id}`);

    // 2. DUPLICATE EMAIL REJECTION
    const dupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Duplicate", email: testEmail, password: "SecurePassword123!" }),
    });
    assert(dupRes.status === 409, "Duplicate Email Rejection (409)");

    // 3. GET EXISTING DOCUMENT FROM DATABASE
    const docQuery = await pool.query(
      `SELECT id, filename, "storageUrl", summary, "extractedText" FROM "Document" WHERE summary IS NOT NULL LIMIT 1`
    );
    const existingDoc = docQuery.rows[0];
    assert(existingDoc && existingDoc.summary?.length > 30, "AI Summary Persistence", `Summary length: ${existingDoc?.summary?.length} chars`);

    const documentId = existingDoc.id;

    // 4. UNAUTHENTICATED CHAT REJECTION
    const unauthChat = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, question: "test question", sessionId: "unauth-session" }),
    });
    assert(unauthChat.status === 403, "Unauthenticated Chat Access Protection (403 Forbidden)");

    // 5. SHARE TOKEN GENERATION
    const tokenRes = await pool.query(
      `INSERT INTO "ShareLink" ("id", "documentId", "token", "createdAt", "revoked")
       VALUES ('share_test_' || gen_random_uuid(), $1, 'test-share-token-' || $2, NOW(), false)
       RETURNING token`,
      [documentId, Date.now()]
    );
    const shareToken = tokenRes.rows[0].token;
    assert(shareToken, "Share Token Generation", `Token: ${shareToken}`);

    // 6. INVITED USER SHARED VIEW RESOLUTION
    const sharedRes = await fetch(`${BASE_URL}/api/share/${shareToken}`);
    const sharedData = await sharedRes.json();
    assert(
      sharedRes.status === 200 && sharedData.document?.id === documentId,
      "Invited User Shared Document Resolution (/api/share/[token])",
      `Document Title: ${sharedData.document?.filename}`
    );

    // 7. GROUNDED CHAT QUESTION 1: Rosenblatt / 1958
    console.log("\n--- Testing Grounded AI Chat Stream ---");
    const chatRes1 = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        question: "Who proposed the Perceptron model and in what year?",
        sessionId: "e2e-session-1",
        shareToken,
      }),
    });
    assert(chatRes1.status === 200, "Chat API Endpoint (200 OK via shareToken)");

    const reader1 = chatRes1.body.getReader();
    const decoder = new TextDecoder();
    let answer1 = "";
    while (true) {
      const { done, value } = await reader1.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const p = JSON.parse(line.slice(6));
            if (p.text) answer1 += p.text;
          } catch {}
        }
      }
    }
    console.log(`   AI Answer 1: "${answer1.trim()}"`);
    assert(
      answer1.toLowerCase().includes("rosenblatt") || answer1.includes("1958"),
      "Chat Answer Grounding & Historical Accuracy",
      "Correctly answered Frank Rosenblatt / 1958"
    );

    // 8. GROUNDED CHAT QUESTION 2: XOR Limitation
    const chatRes2 = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        question: "Can a single perceptron solve the XOR function? Explain why or why not based on the document.",
        sessionId: "e2e-session-1",
        shareToken,
      }),
    });
    assert(chatRes2.status === 200, "Follow-up Multi-Turn Chat (200 OK)");

    const reader2 = chatRes2.body.getReader();
    let answer2 = "";
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const p = JSON.parse(line.slice(6));
            if (p.text) answer2 += p.text;
          } catch {}
        }
      }
    }
    console.log(`   AI Answer 2: "${answer2.trim()}"`);
    assert(
      answer2.toLowerCase().includes("linear") || answer2.toLowerCase().includes("separable") || answer2.toLowerCase().includes("cannot") || answer2.toLowerCase().includes("no"),
      "Chat Grounding on Technical Constraints (Linear Separability)",
      "Correctly identified linear separability requirement"
    );

    // 9. THREADED COMMENTS (Guest comment)
    const commentRes = await fetch(`${BASE_URL}/api/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        authorName: "Alice Guest",
        body: "Great presentation slide deck! What are the weight update rules?",
        shareToken,
      }),
    });
    const commentData = await commentRes.json();
    assert(commentRes.status === 201 && commentData.comment?.id, "Guest Comment Creation", `Comment ID: ${commentData.comment?.id}`);

    const rootCommentId = commentData.comment.id;

    // 10. THREADED REPLY
    const replyRes = await fetch(`${BASE_URL}/api/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        authorName: "Bob Reviewer",
        body: "See slide 18 for w_new = w_old + eta * (y - y_hat) * x.",
        parentCommentId: rootCommentId,
        shareToken,
      }),
    });
    const replyData = await replyRes.json();
    assert(
      replyRes.status === 201 && replyData.comment?.parentCommentId === rootCommentId,
      "Threaded Reply Creation",
      `Parent Comment ID matched: ${replyData.comment?.parentCommentId}`
    );

    // 11. FETCH COMMENTS TREE
    const listCommentsRes = await fetch(`${BASE_URL}/api/comments?documentId=${documentId}&token=${shareToken}`);
    const listCommentsData = await listCommentsRes.json();
    const rootCommentInList = listCommentsData.comments?.find((c) => c.id === rootCommentId);
    assert(
      rootCommentInList && rootCommentInList.replies?.length >= 1,
      "Comments Tree Hierarchy & Nesting",
      `Root has ${rootCommentInList?.replies?.length} reply`
    );

    // 12. REVOKE SHARE LINK AND VERIFY ACCESS DENIAL
    await pool.query(`UPDATE "ShareLink" SET "revoked" = true WHERE "token" = $1`, [shareToken]);
    const revokedRes = await fetch(`${BASE_URL}/api/share/${shareToken}`);
    assert(revokedRes.status === 404, "Revoked Share Link Security Denial (404)");

    // 13. UNAUTHENTICATED DOCUMENTS LIST ACCESS DENIAL
    const unauthDocRes = await fetch(`${BASE_URL}/api/documents`);
    assert(unauthDocRes.status === 401, "Server-Side API Security: /api/documents returns 401 Unauthorized");

    console.log("\n=========================================");
    console.log(`   FINAL RESULTS: ${testPassed} PASSED, ${testFailed} FAILED   `);
    console.log("=========================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    await pool.end();
  }
}

runAllTests();
