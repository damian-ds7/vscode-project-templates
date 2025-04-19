add_executable(#{TESTS_FILE} #{TESTS_FILE})

//-- BEGIN OPTIONAL: includeCatch2
include(FetchContent)
FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG #{CATCH2_VERSION=3.4.0}
)
FetchContent_MakeAvailable(Catch2)

target_link_libraries(#{TESTS_FILE} PRIVATE Catch2::Catch2WithMain)
//-- END OPTIONAL: includeCatch2
