import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import Papa from "papaparse";
import styles from "./index.module.css";

export default function Home() {
  // =======================================================
  // DATA STATE
  // =======================================================

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState("");
  const [dataSource, setDataSource] = useState("");

  const [selectedX, setSelectedX] = useState("");
  const [selectedY, setSelectedY] = useState("");

  const [chartType, setChartType] = useState("bar");
  const [aggregation, setAggregation] = useState("sum");

  const [searchTerm, setSearchTerm] = useState("");
  const [previewRows, setPreviewRows] = useState(10);

  // =======================================================
  // AI STATE
  // =======================================================

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // =======================================================
  // CHART REFERENCES
  // =======================================================

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // =======================================================
  // PROCESS DATASET
  // =======================================================

  const processDataset = (results, name, source) => {
    const cleanData = results.data.filter((row) =>
      Object.values(row).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== ""
      )
    );

    const fields = results.meta.fields || [];

    setData(cleanData);
    setColumns(fields);

    setFileName(name);
    setDataSource(source);

    // Reset old state
    setSearchTerm("");
    setAiQuestion("");
    setAiResponse("");
    setAiLoading(false);

    setChartType("bar");
    setAggregation("sum");

    // Default X-axis = first column
    setSelectedX(fields[0] || "");

    // Find first numeric column for Y-axis
    const numericColumn = fields.find((field) =>
      cleanData.some(
        (row) =>
          typeof row[field] === "number" &&
          !Number.isNaN(row[field])
      )
    );

    setSelectedY(numericColumn || fields[1] || "");
  };

  // =======================================================
  // LOAD SAMPLE DATASET
  // =======================================================

  const loadSampleDataset = async (
    path,
    displayName,
    sourceName
  ) => {
    try {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error("Could not load sample dataset.");
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,

        complete: function (results) {
          processDataset(
            results,
            displayName,
            sourceName
          );
        },

        error: function (error) {
          console.error(
            "Error parsing sample CSV:",
            error
          );
        },
      });
    } catch (error) {
      console.error(
        "Error loading sample dataset:",
        error
      );

      alert(
        "Unable to load the sample dataset. Make sure the CSV file is inside public/data."
      );
    }
  };

  // =======================================================
  // UPLOAD CUSTOM CSV
  // =======================================================

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,

      complete: function (results) {
        processDataset(
          results,
          file.name,
          "Uploaded CSV"
        );
      },

      error: function (error) {
        console.error(
          "Error reading uploaded CSV:",
          error
        );
      },
    });
  };

  // =======================================================
  // DETECT NUMERIC COLUMNS
  // =======================================================

  const numericColumns = columns.filter((column) =>
    data.some(
      (row) =>
        typeof row[column] === "number" &&
        !Number.isNaN(row[column])
    )
  );

  // =======================================================
  // AGGREGATE DATA
  // =======================================================

  const getAggregatedData = () => {
    if (
      !selectedX ||
      !selectedY ||
      data.length === 0
    ) {
      return {
        labels: [],
        values: [],
      };
    }

    const groups = {};

    data.forEach((row) => {
      const xValue =
        row[selectedX] === null ||
        row[selectedX] === undefined ||
        row[selectedX] === ""
          ? "Unknown"
          : String(row[selectedX]);

      const yValue = Number(row[selectedY]);

      if (!groups[xValue]) {
        groups[xValue] = [];
      }

      if (!Number.isNaN(yValue)) {
        groups[xValue].push(yValue);
      }
    });

    const labels = Object.keys(groups);

    const values = labels.map((label) => {
      const numbers = groups[label];

      if (aggregation === "count") {
        return numbers.length;
      }

      if (numbers.length === 0) {
        return 0;
      }

      if (aggregation === "average") {
        return (
          numbers.reduce(
            (sum, value) => sum + value,
            0
          ) / numbers.length
        );
      }

      if (aggregation === "max") {
        return Math.max(...numbers);
      }

      if (aggregation === "min") {
        return Math.min(...numbers);
      }

      return numbers.reduce(
        (sum, value) => sum + value,
        0
      );
    });

    return {
      labels,
      values,
    };
  };

  // =======================================================
  // CREATE CHART
  // =======================================================

  useEffect(() => {
    if (!chartRef.current) return;
    if (data.length === 0) return;
    if (!selectedX || !selectedY) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const { labels, values } =
      getAggregatedData();

    let chartData;

    // -------------------------------------------------------
    // SCATTER
    // -------------------------------------------------------

    if (chartType === "scatter") {
      chartData = {
        datasets: [
          {
            label: `${selectedY} vs ${selectedX}`,

            data: data
              .map((row) => ({
                x: Number(row[selectedX]),
                y: Number(row[selectedY]),
              }))
              .filter(
                (point) =>
                  !Number.isNaN(point.x) &&
                  !Number.isNaN(point.y)
              ),

            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      };
    } else {
      // -------------------------------------------------------
      // BAR / LINE / PIE / DOUGHNUT
      // -------------------------------------------------------

      chartData = {
        labels,

        datasets: [
          {
            label:
              aggregation === "count"
                ? `Count by ${selectedX}`
                : `${capitalize(
                    aggregation
                  )} of ${selectedY}`,

            data: values,

            borderWidth: 2,

            tension: 0.25,
          },
        ],
      };
    }

    chartInstanceRef.current = new Chart(
      chartRef.current,
      {
        type: chartType,

        data: chartData,

        options: {
          responsive: true,
          maintainAspectRatio: false,

          interaction: {
            mode: "nearest",
            intersect: false,
          },

          plugins: {
            title: {
              display: true,

              text:
                chartType === "scatter"
                  ? `${selectedY} vs ${selectedX}`
                  : `${capitalize(
                      aggregation
                    )} of ${selectedY} by ${selectedX}`,

              font: {
                size: 18,
              },

              padding: 20,
            },

            legend: {
              position: "top",
            },

            tooltip: {
              enabled: true,
            },
          },

          scales:
            chartType === "pie" ||
            chartType === "doughnut"
              ? {}
              : {
                  y: {
                    beginAtZero: true,
                  },
                },
        },
      }
    );

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [
    data,
    selectedX,
    selectedY,
    chartType,
    aggregation,
  ]);

  // =======================================================
  // SEARCH DATASET
  // =======================================================

  const filteredData = data.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  // =======================================================
  // AI DATA ASSISTANT
  // =======================================================

  const askAI = async () => {
    if (!aiQuestion.trim()) return;
    if (data.length === 0) return;
    if (aiLoading) return;

    setAiLoading(true);
    setAiResponse("");

    try {
      const datasetText = JSON.stringify(
        data.slice(0, 100),
        null,
        2
      );

      const currentChartData =
        getAggregatedData();

      const prompt = `
You are an AI data analysis assistant inside an interactive data visualization application.

Analyze ONLY the supplied dataset.
Do not invent values that are not present.

DATA SOURCE:
${dataSource}

DATASET FILE:
${fileName}

DATASET COLUMNS:
${columns.join(", ")}

TOTAL ROWS:
${data.length}

DATA:
${datasetText}

CURRENT VISUALIZATION:

Chart type: ${chartType}
X-axis: ${selectedX}
Y-axis: ${selectedY}
Aggregation: ${aggregation}

Current chart categories:
${JSON.stringify(currentChartData.labels)}

Current chart values:
${JSON.stringify(currentChartData.values)}

USER QUESTION:
${aiQuestion}

Instructions:

1. Answer using only the supplied dataset.
2. Perform calculations carefully when necessary.
3. Double-check numerical comparisons before stating which value is highest or lowest.
4. Explain the current visualization when relevant.
5. Identify useful patterns, comparisons, maximums, minimums, averages, or relationships.
6. Keep the response clear and concise.
7. Do not claim information that cannot be determined from the dataset.
`;

      // Send the question to the existing server route
      const response = await fetch(
        "/api/generate?endpoint=chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: prompt,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        setAiResponse(
          "The AI assistant was unable to analyze the data."
        );

        setAiLoading(false);
        return;
      }

      // Start streaming response
      const eventSource = new EventSource(
        "/api/generate?endpoint=stream"
      );

      let fullResponse = "";
      let finishTimer = null;

      // -------------------------------------------------------
      // FINISH STREAM
      // -------------------------------------------------------

      const finishStream = () => {
        if (finishTimer) {
          clearTimeout(finishTimer);
        }

        eventSource.close();

        setAiLoading(false);
      };

      // -------------------------------------------------------
      // RECEIVE RESPONSE CHUNKS
      // -------------------------------------------------------

      eventSource.onmessage = function (
        event
      ) {
        try {
          const parsedData = JSON.parse(
            event.data
          );

          fullResponse += parsedData;

          setAiResponse(fullResponse);

          /*
            Every new chunk restarts this timer.

            When nothing new arrives for 1 second,
            the response is treated as finished.
          */

          if (finishTimer) {
            clearTimeout(finishTimer);
          }

          finishTimer = setTimeout(() => {
            finishStream();
          }, 1000);
        } catch (error) {
          console.error(
            "Error reading AI stream:",
            error
          );

          finishStream();
        }
      };

      // -------------------------------------------------------
      // STREAM ERROR / CLOSE
      // -------------------------------------------------------

      eventSource.onerror = function () {
        finishStream();
      };
    } catch (error) {
      console.error(
        "AI analysis error:",
        error
      );

      setAiResponse(
        "An error occurred while analyzing the data. Please try again."
      );

      setAiLoading(false);
    }
  };

  // =======================================================
  // ENTER KEY FOR AI
  // =======================================================

  const handleAIKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        !aiLoading &&
        aiQuestion.trim()
      ) {
        askAI();
      }
    }
  };

  // =======================================================
  // HELPER
  // =======================================================

  function capitalize(word) {
    if (!word) return "";

    return (
      word.charAt(0).toUpperCase() +
      word.slice(1)
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <div className={styles.page}>
      <Head>
        <title>
          Interactive Data Visualizer
        </title>
      </Head>

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className={styles.header}>
        <h1>
          Interactive Data Visualizer
        </h1>

        <p>
          Choose a sample dataset or upload
          your own CSV, create interactive
          visualizations, explore the data, and
          ask AI questions.
        </p>
      </header>

      {/* ===================================================
          STEP 1 - CHOOSE DATASET
      =================================================== */}

      <section className={styles.card}>
        <div
          className={styles.sectionTitle}
        >
          <span
            className={styles.stepNumber}
          >
            1
          </span>

          <div>
            <h2>Choose a Dataset</h2>

            <p>
              Start with one of the sample
              datasets or upload your own CSV
              file.
            </p>
          </div>
        </div>

        {/* SAMPLE DATASET CARDS */}

        <div
          className={
            styles.datasetChoiceGrid
          }
        >
          {/* E-COMMERCE DATASET */}

          <div
            className={
              styles.datasetChoiceCard
            }
          >
            <div
              className={
                styles.datasetIcon
              }
            >
              $
            </div>

            <div>
              <h3>
                E-Commerce Sales
              </h3>

              <p>
                Explore orders, product
                categories, regions, revenue,
                discounts, ratings, shipping,
                and returns.
              </p>

              <div
                className={
                  styles.datasetMeta
                }
              >
                60 rows • 13 fields
              </div>
            </div>

            <button
              type="button"
              className={
                styles.datasetButton
              }
              onClick={() =>
                loadSampleDataset(
                  "/data/sample_ecommerce_sales.csv",
                  "sample_ecommerce_sales.csv",
                  "E-Commerce Sales Sample"
                )
              }
            >
              Use This Dataset
            </button>
          </div>

          {/* STUDENT DATASET */}

          <div
            className={
              styles.datasetChoiceCard
            }
          >
            <div
              className={
                styles.datasetIcon
              }
            >
              A+
            </div>

            <div>
              <h3>
                Student Study Habits
              </h3>

              <p>
                Explore study hours, sleep,
                attendance, stress, exam
                scores, GPA, majors, and
                learning styles.
              </p>

              <div
                className={
                  styles.datasetMeta
                }
              >
                72 rows • 12 fields
              </div>
            </div>

            <button
              type="button"
              className={
                styles.datasetButton
              }
              onClick={() =>
                loadSampleDataset(
                  "/data/sample_student_study_habits.csv",
                  "sample_student_study_habits.csv",
                  "Student Study Habits Sample"
                )
              }
            >
              Use This Dataset
            </button>
          </div>
        </div>

        {/* OR DIVIDER */}

        <div
          className={styles.orDivider}
        >
          <span>OR</span>
        </div>

        {/* CUSTOM CSV */}

        <label
          className={styles.uploadBox}
        >
          <div
            className={styles.uploadIcon}
          >
            ↑
          </div>

          <strong>
            Upload Your Own CSV
          </strong>

          <span>
            Click here to select a CSV file
            from your computer
          </span>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
          />
        </label>
      </section>

      {/* ===================================================
          REST OF APP
      =================================================== */}

      {data.length > 0 && (
        <>
          {/* DATASET SUMMARY */}

          <div
            className={styles.summaryGrid}
          >
            <div
              className={styles.summaryCard}
            >
              <span>Rows</span>

              <strong>
                {data.length}
              </strong>
            </div>

            <div
              className={styles.summaryCard}
            >
              <span>Columns</span>

              <strong>
                {columns.length}
              </strong>
            </div>

            <div
              className={styles.summaryCard}
            >
              <span>
                Numeric Fields
              </span>

              <strong>
                {numericColumns.length}
              </strong>
            </div>

            <div
              className={styles.summaryCard}
            >
              <span>Dataset</span>

              <strong
                className={
                  styles.fileSummary
                }
              >
                {fileName}
              </strong>
            </div>
          </div>

          {/* =================================================
              STEP 2 - BUILD VISUALIZATION
          ================================================= */}

          <section
            className={styles.card}
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <span
                className={
                  styles.stepNumber
                }
              >
                2
              </span>

              <div>
                <h2>
                  Build Visualization
                </h2>

                <p>
                  Select how you want to
                  visualize your data.
                </p>
              </div>
            </div>

            <div
              className={
                styles.controlsGrid
              }
            >
              <div
                className={styles.control}
              >
                <label>
                  Chart Type
                </label>

                <select
                  value={chartType}
                  onChange={(e) =>
                    setChartType(
                      e.target.value
                    )
                  }
                >
                  <option value="bar">
                    Bar Chart
                  </option>

                  <option value="line">
                    Line Chart
                  </option>

                  <option value="pie">
                    Pie Chart
                  </option>

                  <option value="doughnut">
                    Doughnut Chart
                  </option>

                  <option value="scatter">
                    Scatter Plot
                  </option>
                </select>
              </div>

              <div
                className={styles.control}
              >
                <label>X-Axis</label>

                <select
                  value={selectedX}
                  onChange={(e) =>
                    setSelectedX(
                      e.target.value
                    )
                  }
                >
                  {columns.map(
                    (column) => (
                      <option
                        key={column}
                        value={column}
                      >
                        {column}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div
                className={styles.control}
              >
                <label>Y-Axis</label>

                <select
                  value={selectedY}
                  onChange={(e) =>
                    setSelectedY(
                      e.target.value
                    )
                  }
                >
                  {numericColumns.map(
                    (column) => (
                      <option
                        key={column}
                        value={column}
                      >
                        {column}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div
                className={styles.control}
              >
                <label>
                  Aggregation
                </label>

                <select
                  value={aggregation}
                  onChange={(e) =>
                    setAggregation(
                      e.target.value
                    )
                  }
                  disabled={
                    chartType ===
                    "scatter"
                  }
                >
                  <option value="sum">
                    Sum
                  </option>

                  <option value="average">
                    Average
                  </option>

                  <option value="count">
                    Count
                  </option>

                  <option value="max">
                    Maximum
                  </option>

                  <option value="min">
                    Minimum
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* =================================================
              STEP 3 - VISUALIZATION
          ================================================= */}

          <section
            className={styles.card}
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <span
                className={
                  styles.stepNumber
                }
              >
                3
              </span>

              <div>
                <h2>
                  Visualization
                </h2>

                <p>
                  Hover over the chart to
                  explore individual values.
                </p>
              </div>
            </div>

            <div
              className={
                styles.chartContainer
              }
            >
              <canvas
                ref={chartRef}
              ></canvas>
            </div>
          </section>

          {/* =================================================
              STEP 4 - EXPLORE DATASET
          ================================================= */}

          <section
            className={styles.card}
          >
            <div
              className={
                styles.tableHeader
              }
            >
              <div
                className={
                  styles.sectionTitle
                }
              >
                <span
                  className={
                    styles.stepNumber
                  }
                >
                  4
                </span>

                <div>
                  <h2>
                    Explore Dataset
                  </h2>

                  <p>
                    Search and preview your
                    selected dataset.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.tableTools
                }
              >
                <input
                  className={
                    styles.searchInput
                  }
                  type="text"
                  placeholder="Search data..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                />

                <select
                  value={previewRows}
                  onChange={(e) =>
                    setPreviewRows(
                      Number(
                        e.target.value
                      )
                    )
                  }
                >
                  <option value={5}>
                    5 rows
                  </option>

                  <option value={10}>
                    10 rows
                  </option>

                  <option value={20}>
                    20 rows
                  </option>

                  <option value={50}>
                    50 rows
                  </option>
                </select>
              </div>
            </div>

            <div
              className={
                styles.tableWrapper
              }
            >
              <table
                className={
                  styles.dataTable
                }
              >
                <thead>
                  <tr>
                    {columns.map(
                      (column) => (
                        <th key={column}>
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredData
                    .slice(
                      0,
                      previewRows
                    )
                    .map(
                      (
                        row,
                        rowIndex
                      ) => (
                        <tr
                          key={
                            rowIndex
                          }
                        >
                          {columns.map(
                            (
                              column
                            ) => (
                              <td
                                key={
                                  column
                                }
                              >
                                {String(
                                  row[
                                    column
                                  ] ?? ""
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>

            <div
              className={
                styles.tableFooter
              }
            >
              Showing{" "}
              {Math.min(
                previewRows,
                filteredData.length
              )}{" "}
              of{" "}
              {filteredData.length}{" "}
              matching rows
            </div>
          </section>

          {/* =================================================
              STEP 5 - AI DATA ASSISTANT
          ================================================= */}

          <section
            className={styles.card}
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              <span
                className={
                  styles.stepNumber
                }
              >
                5
              </span>

              <div>
                <h2>
                  AI Data Assistant
                </h2>

                <p>
                  Ask questions about your
                  dataset and current
                  visualization.
                </p>
              </div>
            </div>

            {/* QUICK QUESTIONS */}

            <div
              className={
                styles.aiExamples
              }
            >
              <span>Try asking:</span>

              <button
                type="button"
                onClick={() =>
                  setAiQuestion(
                    "What are the most important patterns in this dataset?"
                  )
                }
              >
                Find patterns
              </button>

              <button
                type="button"
                onClick={() =>
                  setAiQuestion(
                    "Which categories have the highest values?"
                  )
                }
              >
                Highest values
              </button>

              <button
                type="button"
                onClick={() =>
                  setAiQuestion(
                    "Summarize this dataset."
                  )
                }
              >
                Summarize data
              </button>

              <button
                type="button"
                onClick={() =>
                  setAiQuestion(
                    "Explain what the current visualization shows."
                  )
                }
              >
                Explain chart
              </button>
            </div>

            {/* AI QUESTION */}

            <div
              className={
                styles.aiInputArea
              }
            >
              <textarea
                className={
                  styles.aiTextarea
                }
                value={aiQuestion}
                onChange={(e) =>
                  setAiQuestion(
                    e.target.value
                  )
                }
                onKeyDown={
                  handleAIKeyDown
                }
                placeholder="Ask a question about the selected dataset..."
              />

              <button
                className={
                  styles.aiButton
                }
                type="button"
                onClick={askAI}
                disabled={
                  aiLoading ||
                  !aiQuestion.trim()
                }
              >
                {aiLoading
                  ? "Analyzing..."
                  : "Ask AI"}
              </button>
            </div>

            <div
              className={styles.aiHint}
            >
              Press Enter to ask. Use
              Shift + Enter for a new line.
            </div>

            {/* AI RESPONSE */}

            {aiResponse && (
              <div
                className={
                  styles.aiResponse
                }
              >
                <div
                  className={
                    styles.aiResponseHeader
                  }
                >
                  AI Analysis
                </div>

                <div
                  className={
                    styles.aiResponseText
                  }
                >
                  {aiResponse}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}